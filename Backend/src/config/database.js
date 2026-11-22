import sql from 'mssql';
import { env } from './env.js';

const mssqlConfig = {
  user: env.dbUser,
  password: env.dbPassword,
  server: env.dbHost,
  port: env.dbPort,
  database: env.dbName,
  pool: {
    max: env.dbPoolMax,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: env.dbSsl,
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

let sharedPoolPromise = null;

const getSharedPool = async () => {
  if (!sharedPoolPromise) {
    const connectionPool = new sql.ConnectionPool(mssqlConfig);
    connectionPool.on('error', (error) => {
      console.error('Unexpected SQL Server pool error:', error);
    });
    sharedPoolPromise = connectionPool.connect().catch((err) => {
      sharedPoolPromise = null;
      throw err;
    });
  }
  return sharedPoolPromise;
};

// Columns that hold JSON arrays or objects in SQL Server (NVARCHAR(MAX))
const JSON_COLUMNS = new Set([
  'permissions',
  'warehouse_ids',
  'permission_ids',
  'metadata',
  'shipping_address_snapshot',
  'address',
  'status_history',
  'errors',
  'error_details',
  'items'
]);

// Columns that PG driver returned as strings (DECIMAL/NUMERIC/BIGINT)
const DECIMAL_TWO_COLS = new Set([
  'sale_price',
  'price',
  'cost_price',
  'total_amount',
  'line_total',
  'unit_price',
  'unit_cost',
  'opening_cash',
  'closing_cash',
  'paid_sales',
  'amount',
  'confirmed_amount',
  'revenue',
  'returned_amount',
  'average_order_value'
]);

const normalizeRow = (row) => {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    let val = v;
    if (typeof val === 'string') {
      // Lowercase UUIDs to match PostgreSQL UUID text format
      if (/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(val)) {
        val = val.toLowerCase();
      } else if (JSON_COLUMNS.has(k) && (val.startsWith('[') || val.startsWith('{'))) {
        try {
          const parsed = JSON.parse(val);
          if ((k === 'warehouse_ids' || k === 'permission_ids') && Array.isArray(parsed)) {
            val = parsed.map((item) => (typeof item === 'string' ? item.toLowerCase() : item));
          } else {
            val = parsed;
          }
        } catch {
          // keep as string
        }
      }
    } else if (typeof val === 'number' && DECIMAL_TWO_COLS.has(k)) {
      val = val.toFixed(2);
    }
    out[k] = val;
  }
  return out;
};

// Map SQL Server error numbers to PostgreSQL SQLSTATE codes so existing services/middlewares work seamlessly
const mapMssqlError = (error) => {
  if (!error) return error;
  const num = error.number;
  if (num === 2627 || num === 2601) {
    error.code = '23505'; // unique_violation
  } else if (num === 547) {
    const msg = String(error.message || '');
    if (/FOREIGN KEY|REFERENCE/i.test(msg)) {
      error.code = '23503'; // foreign_key_violation
    } else {
      error.code = '23514'; // check_violation
    }
  } else if (num === 50001) {
    error.code = '23514'; // custom trigger state transition check
  } else if (num === 8115 || num === 248) {
    error.code = '22003'; // numeric_value_out_of_range
  } else if (num === 8169 || num === 245) {
    error.code = '22P02'; // invalid_text_representation
  } else if (num === 1205) {
    error.code = '40P01'; // deadlock_detected
  }
  return error;
};

/**
 * Translates PostgreSQL-style parameterized SQL ($1, $2, ::type, ILIKE, NOW(), LIMIT/OFFSET, RETURNING, etc.)
 * into T-SQL when needed, or executes T-SQL directly with @p1, @p2 parameters.
 */
export const translatePgToTsql = (sqlText, params = []) => {
  let text = String(sqlText || '').trim();

  // Replace parameter casts first
  text = text.replace(/\$(\d+)::(?:uuid\[\]|text\[\])/gi, '@p$1');
  text = text.replace(/\$(\d+)::(?:uuid|text|varchar|boolean|numeric|int|bigint|jsonb|json|date|timestamp)/gi, '@p$1');

  // Replace general type casts
  text = text.replace(/::numeric\(\d+\s*,\s*\d+\)/gi, '');
  text = text.replace(/::(?:int|integer|bigint|text|varchar|uuid|boolean|jsonb|json|numeric|date|timestamp)/gi, '');

  // Replace $1, $2 -> @p1, @p2
  text = text.replace(/\$(\d+)/g, '@p$1');

  // Replace BTRIM -> TRIM
  text = text.replace(/\bBTRIM\s*\(/gi, 'TRIM(');

  // Replace ILIKE -> LIKE (Database collation is Vietnamese_CI_AS, case-insensitive by default)
  text = text.replace(/\bILIKE\b/gi, 'LIKE');

  // Replace TRUE / FALSE literals
  text = text.replace(/\bIS\s+TRUE\b/gi, '= 1');
  text = text.replace(/\bIS\s+FALSE\b/gi, '= 0');
  text = text.replace(/\bTRUE\b/gi, '1');
  text = text.replace(/\bFALSE\b/gi, '0');

  // Replace gen_random_uuid() -> NEWID()
  text = text.replace(/\bgen_random_uuid\s*\(\)/gi, 'NEWID()');

  // Replace NOW() -> SYSDATETIMEOFFSET()
  text = text.replace(/\bNOW\s*\(\)/gi, 'SYSDATETIMEOFFSET()');

  // Replace current_database() -> DB_NAME()
  text = text.replace(/\bcurrent_database\s*\(\)/gi, 'DB_NAME()');

  // Replace PostgreSQL regex ~ in checks if any
  // Replace GREATEST(a, b) -> IIF((a) >= (b), (a), (b)) for compatibility, though SQL Server 2022 supports GREATEST natively!
  // SQL Server 2022 (16.x) natively supports GREATEST() and LEAST()!
  // Replace CEIL(...) -> CEILING(...)
  text = text.replace(/\bCEIL\s*\(/gi, 'CEILING(');

  // Replace IS NOT DISTINCT FROM
  text = text.replace(/([a-zA-Z0-9_.]+)\s+IS\s+NOT\s+DISTINCT\s+FROM\s+(@p\d+)/gi, '(($1 = $2) OR ($1 IS NULL AND $2 IS NULL))');

  // Replace locking clauses at end of SELECT or before WHERE/ORDER
  // Convert FOR UPDATE SKIP LOCKED / FOR UPDATE OF x / FOR NO KEY UPDATE / FOR UPDATE / FOR SHARE OF x / FOR SHARE
  const hasForUpdateSkipLocked = /\bFOR\s+UPDATE\s+SKIP\s+LOCKED\b/i.test(text);
  const hasForUpdate = /\bFOR\s+(?:NO\s+KEY\s+)?UPDATE(?:\s+OF\s+[a-zA-Z0-9_,\s]+)?\b/i.test(text);
  const hasForShare = /\bFOR\s+SHARE(?:\s+OF\s+[a-zA-Z0-9_,\s]+)?\b/i.test(text);

  text = text.replace(/\bFOR\s+UPDATE\s+SKIP\s+LOCKED\b/gi, '');
  text = text.replace(/\bFOR\s+(?:NO\s+KEY\s+)?UPDATE(?:\s+OF\s+[a-zA-Z0-9_,\s]+)?\b/gi, '');
  text = text.replace(/\bFOR\s+SHARE(?:\s+OF\s+[a-zA-Z0-9_,\s]+)?\b/gi, '');

  // Add row-level locking hints if FOR UPDATE was used on simple FROM <table>
  if (hasForUpdateSkipLocked) {
    text = text.replace(/\bFROM\s+([a-zA-Z0-9_]+)(\s+(?:AS\s+)?[a-zA-Z0-9_]+)?\s+WHERE\b/i, (m, tbl, alias) => {
      const a = alias && !/^(WHERE|JOIN|LEFT|INNER|ORDER|GROUP)$/i.test(alias.trim()) ? alias : '';
      return `FROM ${tbl}${a} WITH (UPDLOCK, ROWLOCK, READPAST) WHERE`;
    });
  } else if (hasForUpdate) {
    text = text.replace(/\bFROM\s+([a-zA-Z0-9_]+)(\s+(?:AS\s+)?[a-zA-Z0-9_]+)?\s+WHERE\b/i, (m, tbl, alias) => {
      const a = alias && !/^(WHERE|JOIN|LEFT|INNER|ORDER|GROUP)$/i.test(alias.trim()) ? alias : '';
      return `FROM ${tbl}${a} WITH (UPDLOCK, ROWLOCK) WHERE`;
    });
  }

  // Replace NULLS LAST / NULLS FIRST in ORDER BY
  text = text.replace(/\b([a-zA-Z0-9_.]+)\s+(ASC\s+)?NULLS\s+LAST\b/gi, 'CASE WHEN $1 IS NULL THEN 1 ELSE 0 END ASC, $1 $2');

  // Replace TO_CHAR(col, 'YYYY-MM-DD') -> CONVERT(VARCHAR(10), col, 23)
  text = text.replace(/\bTO_CHAR\s*\(\s*([^,]+?)\s*,\s*'YYYY-MM-DD'\s*\)/gi, 'CONVERT(VARCHAR(10), $1, 23)');

  // Replace AT TIME ZONE 'Asia/Ho_Chi_Minh' -> AT TIME ZONE 'SE Asia Standard Time'
  text = text.replace(/AT\s+TIME\s+ZONE\s+'Asia\/Ho_Chi_Minh'/gi, "AT TIME ZONE 'SE Asia Standard Time'");

  // Replace ($2 + INTERVAL '1 day') or (@p2 + INTERVAL '1 day') -> DATEADD(day, 1, CAST(@p2 AS DATE))
  text = text.replace(/\(\s*(@p\d+)\s*\+\s*INTERVAL\s+'1 day'\s*\)/gi, 'DATEADD(day, 1, CAST($1 AS DATE))');
  text = text.replace(/SYSDATETIMEOFFSET\(\)\s*\+\s*\(\s*(@p\d+)\s*\*\s*INTERVAL\s+'1 minute'\s*\)/gi, 'DATEADD(minute, $1, SYSDATETIMEOFFSET())');

  // Replace COUNT(*) FILTER (WHERE cond) -> SUM(CASE WHEN cond THEN 1 ELSE 0 END)
  text = text.replace(/COUNT\s*\(\s*\*\s*\)\s*FILTER\s*\(\s*WHERE\s+([^)]+)\)/gi, 'SUM(CASE WHEN $1 THEN 1 ELSE 0 END)');
  // Replace SUM(expr) FILTER (WHERE cond) -> SUM(CASE WHEN cond THEN expr ELSE 0 END)
  text = text.replace(/SUM\s*\(\s*([^)]+)\s*\)\s*FILTER\s*\(\s*WHERE\s+([^)]+)\)/gi, 'SUM(CASE WHEN $2 THEN $1 ELSE 0 END)');
  // Replace AVG(expr) FILTER (WHERE cond) -> AVG(CASE WHEN cond THEN expr ELSE NULL END)
  text = text.replace(/AVG\s*\(\s*([^)]+)\s*\)\s*FILTER\s*\(\s*WHERE\s+([^)]+)\)/gi, 'AVG(CASE WHEN $2 THEN $1 ELSE NULL END)');

  // Replace string concatenation || with +
  text = text.replace(/\s*\|\|\s*/g, ' + ');

  // Replace random() -> RAND(CHECKSUM(NEWID())) and floor(...) -> FLOOR(...)
  text = text.replace(/\bfloor\s*\(\s*random\s*\(\s*\)\s*\*\s*(\d+)\s*\)/gi, 'CAST(FLOOR(RAND(CHECKSUM(NEWID())) * $1) AS VARCHAR(20))');

  // Replace DELETE FROM t1 alias USING t2 alias2 WHERE ...
  text = text.replace(
    /DELETE\s+FROM\s+([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)\s+USING\s+([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)\s+WHERE\s+([\s\S]+?)(?:\s+RETURNING\s+([a-zA-Z0-9_.,\s*]+))?$/i,
    (_, t1, a1, t2, a2, whereClause, returningCols) => {
      const outputClause = returningCols ? ` OUTPUT ${returningCols.replace(new RegExp(`\\b${a1}\\.`, 'g'), 'DELETED.')}` : '';
      return `DELETE ${a1}${outputClause} FROM ${t1} ${a1} JOIN ${t2} ${a2} ON 1=1 WHERE ${whereClause}`;
    }
  );

  // Replace = ANY(@pN) -> IN (SELECT value FROM OPENJSON(@pN))
  text = text.replace(/=\s*ANY\s*\(\s*(@p\d+)\s*\)/gi, 'IN (SELECT value FROM OPENJSON($1))');

  // Replace RETURNING in INSERT / UPDATE / DELETE (when not already handled)
  // Note: If table has triggers (like orders), SQL Server requires OUTPUT INTO or simple SELECT after if no trigger conflicts,
  // or for orders UPDATE we can handle RETURNING safely.
  if (/\bRETURNING\b/i.test(text)) {
    const isOrdersUpdate = /^\s*UPDATE\s+(?:dbo\.)?orders\b/i.test(text);
    if (isOrdersUpdate) {
      // dbo.orders has an AFTER UPDATE trigger, so OUTPUT without INTO is not allowed directly on UPDATE orders.
      // Convert UPDATE orders SET ... WHERE id = @p1 ... RETURNING cols -> UPDATE orders SET ... WHERE id = @p1 ...; SELECT cols FROM orders WHERE id = @p1;
      text = text.replace(
        /^(\s*UPDATE\s+(?:dbo\.)?orders\s+SET\s+[\s\S]+?\s+WHERE\s+id\s*=\s*(@p\d+)(?:\s+AND\s+[^\n]+?)?)\s+RETURNING\s+([\s\S]+)$/i,
        '$1; IF @@ROWCOUNT > 0 SELECT $3 FROM dbo.orders WHERE id = $2;'
      );
    } else if (/^\s*INSERT\s+INTO\b/i.test(text)) {
      // INSERT INTO tbl (...) VALUES (...) RETURNING cols
      // or INSERT INTO tbl (...) SELECT ... RETURNING cols
      if (/\bVALUES\s*\(/i.test(text)) {
        text = text.replace(
          /^(\s*INSERT\s+INTO\s+[a-zA-Z0-9_.[\]]+(?:\s*\([^)]+\))?)\s+(VALUES\s*\([\s\S]+?\))\s+RETURNING\s+([\s\S]+)$/i,
          (_, prefix, valuesPart, retCols) => {
            const outCols = retCols
              .split(',')
              .map((c) => {
                const trimmed = c.trim();
                if (trimmed === '*') return 'INSERTED.*';
                return `INSERTED.${trimmed}`;
              })
              .join(', ');
            return `${prefix} OUTPUT ${outCols} ${valuesPart}`;
          }
        );
      } else {
        text = text.replace(
          /^(\s*INSERT\s+INTO\s+[a-zA-Z0-9_.[\]]+(?:\s*\([^)]+\))?)\s+(SELECT\s+[\s\S]+?)\s+RETURNING\s+([\s\S]+)$/i,
          (_, prefix, selectPart, retCols) => {
            const outCols = retCols
              .split(',')
              .map((c) => {
                const trimmed = c.trim();
                if (trimmed === '*') return 'INSERTED.*';
                return `INSERTED.${trimmed}`;
              })
              .join(', ');
            return `${prefix} OUTPUT ${outCols} ${selectPart}`;
          }
        );
      }
    } else if (/^\s*UPDATE\b/i.test(text)) {
      text = text.replace(
        /^(\s*UPDATE\s+[a-zA-Z0-9_.[\]]+\s+SET\s+[\s\S]+?)\s+(WHERE\s+[\s\S]+?)\s+RETURNING\s+([\s\S]+)$/i,
        (_, updatePart, wherePart, retCols) => {
          const outCols = retCols
            .split(',')
            .map((c) => {
              const trimmed = c.trim();
              if (trimmed === '*') return 'INSERTED.*';
              return `INSERTED.${trimmed}`;
            })
            .join(', ');
          return `${updatePart} OUTPUT ${outCols} ${wherePart}`;
        }
      );
    } else if (/^\s*DELETE\b/i.test(text)) {
      text = text.replace(
        /^(\s*DELETE\s+FROM\s+[a-zA-Z0-9_.[\]]+)\s+(WHERE\s+[\s\S]+?)\s+RETURNING\s+([\s\S]+)$/i,
        (_, delPart, wherePart, retCols) => {
          const outCols = retCols
            .split(',')
            .map((c) => {
              const trimmed = c.trim();
              if (trimmed === '*') return 'DELETED.*';
              return `DELETED.${trimmed}`;
            })
            .join(', ');
          return `${delPart} OUTPUT ${outCols} ${wherePart}`;
        }
      );
    }
  }

  // Replace LIMIT X OFFSET Y -> OFFSET Y ROWS FETCH NEXT X ROWS ONLY (requires ORDER BY)
  text = text.replace(/\bLIMIT\s+(@p\d+|\d+)\s+OFFSET\s+(@p\d+|\d+)\s*;?\s*$/i, 'OFFSET $2 ROWS FETCH NEXT $1 ROWS ONLY');

  // Replace standalone LIMIT X at end of query -> SELECT TOP (X)
  if (/\bLIMIT\s+(@p\d+|\d+)\s*;?\s*$/i.test(text)) {
    const limitMatch = text.match(/\bLIMIT\s+(@p\d+|\d+)\s*;?\s*$/i);
    const limitExpr = limitMatch[1];
    text = text.replace(/\bLIMIT\s+(@p\d+|\d+)\s*;?\s*$/i, '');
    text = text.replace(/^\s*SELECT\b/i, `SELECT TOP (${limitExpr})`);
  }

  // Prefix Vietnamese / non-ASCII string literals with N'...' if not already N'...'
  text = text.replace(/(?<![N\w])'([^']*[^\x00-\x7F][^']*)'/g, "N'$1'");

  return text;
};

const bindParams = (request, params = []) => {
  params.forEach((val, idx) => {
    const paramName = `p${idx + 1}`;
    if (Array.isArray(val)) {
      request.input(paramName, sql.NVarChar(sql.MAX), JSON.stringify(val));
    } else if (typeof val === 'boolean') {
      request.input(paramName, sql.Bit, val ? 1 : 0);
    } else {
      request.input(paramName, val === undefined ? null : val);
    }
  });
};

const executeRequest = async (target, sqlText, params = []) => {
  const translated = translatePgToTsql(sqlText, params);
  const request = target.request();
  bindParams(request, params);
  try {
    const result = await request.query(translated);
    const rows = (result.recordset || []).map(normalizeRow);
    const affected = Array.isArray(result.rowsAffected)
      ? result.rowsAffected.reduce((a, b) => a + b, 0)
      : 0;
    const rowCount = result.recordset ? rows.length : affected;
    return {
      rows,
      rowCount,
      command: translated.trim().split(/\s+/)[0]?.toUpperCase() || 'SELECT'
    };
  } catch (error) {
    throw mapMssqlError(error);
  }
};

export const query = async (text, params = []) => {
  const activePool = await getSharedPool();
  return executeRequest(activePool, text, params);
};

class MssqlTransactionalClient {
  constructor(poolInstance) {
    this.poolInstance = poolInstance;
    this.transaction = null;
    this.inTransaction = false;
  }

  async query(text, params = []) {
    const trimmed = String(text || '').trim().toUpperCase();
    if (trimmed === 'BEGIN' || trimmed === 'BEGIN TRANSACTION' || trimmed === 'BEGIN READ ONLY') {
      if (!this.inTransaction) {
        this.transaction = new sql.Transaction(this.poolInstance);
        await this.transaction.begin();
        this.inTransaction = true;
      }
      return { rows: [], rowCount: 0, command: 'BEGIN' };
    }
    if (trimmed === 'COMMIT' || trimmed === 'COMMIT TRANSACTION') {
      if (this.inTransaction && this.transaction) {
        await this.transaction.commit();
        this.inTransaction = false;
        this.transaction = null;
      }
      return { rows: [], rowCount: 0, command: 'COMMIT' };
    }
    if (trimmed === 'ROLLBACK' || trimmed === 'ROLLBACK TRANSACTION') {
      if (this.inTransaction && this.transaction) {
        try {
          await this.transaction.rollback();
        } catch {
          // ignore if already rolled back
        }
        this.inTransaction = false;
        this.transaction = null;
      }
      return { rows: [], rowCount: 0, command: 'ROLLBACK' };
    }

    const target = this.inTransaction && this.transaction ? this.transaction : this.poolInstance;
    return executeRequest(target, text, params);
  }

  release() {
    if (this.inTransaction && this.transaction) {
      this.transaction.rollback().catch(() => {});
      this.inTransaction = false;
      this.transaction = null;
    }
  }
}

export const pool = {
  connect: async () => {
    const activePool = await getSharedPool();
    return new MssqlTransactionalClient(activePool);
  },
  query: (text, params) => query(text, params),
  end: async () => {
    if (sharedPoolPromise) {
      const activePool = await sharedPoolPromise;
      sharedPoolPromise = null;
      await activePool.close();
    }
  },
  on: () => {}
};

export const closeDatabase = () => pool.end();
