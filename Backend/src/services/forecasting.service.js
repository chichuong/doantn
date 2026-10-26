import { AppError } from '../utils/app-error.js';
import { assertDate } from '../utils/validation.js';
import { forecastWithPython } from './forecasting-python.service.js';
import {
  createForecastRun,
  getForecastAlerts,
  getForecastRun,
  getHistoricalDemand,
  getWarehouseCode,
  listForecastProducts,
  listForecastRuns
} from '../models/forecasting.model.js';

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const isoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
const formatDate = (date) => date.toISOString().slice(0, 10);
const addDays = (date, days) => { const result = new Date(`${date}T00:00:00Z`); result.setUTCDate(result.getUTCDate() + days); return formatDate(result); };
const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const round = (value) => Number(value.toFixed(2));

const parseRunInput = (input) => {
  const today = formatDate(new Date(Date.now() + 7 * 60 * 60 * 1000));
  const defaultTo = addDays(today, -1);
  const toDate = input.toDate || defaultTo;
  let lookbackDays = Number(input.lookbackDays ?? 30);
  const horizonDays = Number(input.horizonDays ?? 7);
  if (!isoDate(toDate) || toDate >= today) throw new AppError(400, 'toDate phải là ngày trước ngày hiện tại và có định dạng YYYY-MM-DD');
  if (!Number.isInteger(lookbackDays) || lookbackDays < 7 || lookbackDays > 365) throw new AppError(400, 'lookbackDays phải từ 7 đến 365');
  if (!Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > 30) throw new AppError(400, 'horizonDays phải từ 1 đến 30');
  const fromDate = input.fromDate || addDays(toDate, -(lookbackDays - 1));
  assertDate(toDate, 'toDate'); assertDate(fromDate, 'fromDate');
  lookbackDays = (Date.parse(toDate) - Date.parse(fromDate)) / 86400000 + 1;
  if (lookbackDays < 7 || lookbackDays > 365) throw new AppError(400, 'Khoảng lịch sử phải dài 7–365 ngày');
  if (!isoDate(fromDate) || fromDate > toDate) throw new AppError(400, 'fromDate/toDate không hợp lệ');
  if (input.productId && !isUuid(input.productId)) throw new AppError(400, 'productId không hợp lệ');
  if (input.warehouseId && !isUuid(input.warehouseId)) throw new AppError(400, 'warehouseId không hợp lệ');
  if (input.model !== undefined && !['baseline', 'python'].includes(input.model)) throw new AppError(400, 'model phải là baseline hoặc python');
  if (input.model === 'python' && lookbackDays < 29) throw new AppError(400, 'Dự báo LightGBM cần ít nhất 29 ngày lịch sử');
  if (input.model === 'python' && horizonDays !== 7) throw new AppError(400, 'Mô hình LightGBM hiện chỉ hỗ trợ dự báo 7 ngày');
  return { fromDate, toDate, lookbackDays, horizonDays, productId: input.productId, warehouseId: input.warehouseId };
};

const buildSeries = (rows, fromDate, toDate) => {
  const values = new Map(rows.map((row) => [String(row.demand_date), Number(row.quantity)]));
  const series = [];
  for (let date = fromDate; date <= toDate; date = addDays(date, 1)) series.push(values.get(date) || 0);
  return series;
};

const evaluate = (series) => {
  if (series.length < 14) return null;
  const test = series.slice(-7);
  const train = series.slice(0, -7);
  const baseline = average(train.slice(-7));
  const errors = test.map((actual) => actual - baseline);
  return {
    n: errors.length,
    sum_absolute_error: errors.reduce((sum, error) => sum + Math.abs(error), 0),
    sum_squared_error: errors.reduce((sum, error) => sum + error ** 2, 0),
    mae: round(average(errors.map((error) => Math.abs(error)))),
    rmse: round(Math.sqrt(average(errors.map((error) => error ** 2))))
  };
};

export const run = async (input, userId) => {
  const params = parseRunInput(input);
  const products = await listForecastProducts(params.productId);
  if (!products.length) throw new AppError(404, 'Không tìm thấy sản phẩm hoạt động');
  if (products.length > 100) throw new AppError(400, 'Mỗi lần chạy tối đa 100 sản phẩm; chọn productId để giới hạn');
  const warehouseCode = params.warehouseId ? await getWarehouseCode(params.warehouseId) : null;
  if (params.warehouseId && !warehouseCode) throw new AppError(400, 'Kho không tồn tại hoặc đã ngừng hoạt động');
  const values = [];
  const metrics = [];
  const histories = [];
  const metadata = {
    timezone: 'Asia/Ho_Chi_Minh', metric_source: 'last_7_days_holdout',
    bounds_method: 'point_only', missing_days_policy: 'zero_sales',
    target: 'delivered_order_units_by_order_creation_day',
    limitations: ['Doanh số quan sát có thể thấp hơn nhu cầu khi hết hàng', 'Lịch sử dùng trạng thái hoàn tất hiện tại; chưa phải snapshot dữ liệu tại quá khứ']
  };
  for (const product of products) {
    const history = await getHistoricalDemand({ ...params, productId: product.id });
    const series = buildSeries(history, params.fromDate, params.toDate);
    const window = series.slice(-7);
    const predictedQuantity = round(average(window));
    histories.push({ sku: product.sku, warehouse_code: warehouseCode, start_date: params.fromDate, quantities: series });
    const evaluation = evaluate(series);
    if (evaluation) metrics.push(evaluation);
    for (let day = 1; day <= params.horizonDays; day += 1) {
      values.push({
        productId: product.id,
        warehouseId: params.warehouseId,
        forecastDate: addDays(params.toDate, day),
        predictedQuantity,
        lowerBound: predictedQuantity,
        upperBound: predictedQuantity
      });
    }
  }
  let modelName = 'baseline_moving_average_7d';
  if (input.model === 'python') {
    const result = await forecastWithPython({ series: histories, cutoffDate: params.toDate, horizonDays: params.horizonDays });
    values.length = 0; metrics.length = 0;
    const ids = new Map(products.map(product => [product.sku, product.id]));
    for (const product of result.results) {

      const metric =
        product.evaluation?.comparisons?.[product.model_name]?.test;

      if (metric) {
        metrics.push(metric);
      }


      product.quantities.forEach((quantity, index) => {
        const predictedQuantity = Number(quantity.toFixed(6));

        values.push({
          productId: ids.get(product.sku),
          warehouseId: params.warehouseId,
          forecastDate: addDays(params.toDate, index + 1),
          predictedQuantity,
          lowerBound: predictedQuantity,
          upperBound: predictedQuantity
        });
      });

    }
    Object.assign(metadata, result.metadata, { evaluations: result.results.map(({ quantities, ...rest }) => rest) });
    modelName = 'python_selected_model';
  }
  const count = metrics.reduce((sum, metric) => sum + metric.n, 0);
  return createForecastRun({
    modelName, metadata,
    ...params,
    createdBy: userId,
    mae: count ? round(metrics.reduce((sum, metric) => sum + metric.sum_absolute_error, 0) / count) : null,
    rmse: count ? round(Math.sqrt(metrics.reduce((sum, metric) => sum + metric.sum_squared_error, 0) / count)) : null,
    values
  });
};

export const getRun = async (runId) => {
  if (!isUuid(runId)) throw new AppError(400, 'runId không hợp lệ');
  const result = await getForecastRun(runId);
  if (!result) throw new AppError(404, 'Không tìm thấy lần chạy dự báo');
  return result;
};

export const runs = async (query) => {
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const page = Math.max(Number(query.page) || 1, 1);
  const result = await listForecastRuns({ limit, offset: (page - 1) * limit });
  return { data: result.rows, pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) } };
};

export const alerts = async (query) => {
  if (!isUuid(query.runId)) throw new AppError(400, 'runId là bắt buộc và phải là UUID');
  if (query.warehouseId && !isUuid(query.warehouseId)) throw new AppError(400, 'warehouseId không hợp lệ');
  const run = await getForecastRun(query.runId);
  if (!run) throw new AppError(404, 'Không tìm thấy lần chạy dự báo');
  if (query.warehouseId && query.warehouseId !== run.warehouse_id) throw new AppError(409, 'Kho cảnh báo phải trùng phạm vi kho của lần dự báo');
  const warehouseId = run.warehouse_id || undefined;
  const fromDate = query.fromDate || addDays(run.to_date, 1);
  const toDate = query.toDate || addDays(fromDate, run.horizon_days - 1);
  assertDate(fromDate, 'fromDate'); assertDate(toDate, 'toDate');
  if (fromDate > toDate) throw new AppError(400, 'fromDate không được lớn hơn toDate');
  if (fromDate < addDays(run.to_date, 1) || toDate > addDays(run.to_date, run.horizon_days)) throw new AppError(400, 'Khoảng cảnh báo phải nằm trong thời hạn dự báo của run');
  return {
    runId: query.runId, warehouseId: warehouseId || null, period: { fromDate, toDate },
    data: await getForecastAlerts({ runId: query.runId, warehouseId, fromDate, toDate })
  };
};
