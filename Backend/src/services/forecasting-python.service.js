import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

export const forecastWithPython = async ({ series, cutoffDate, horizonDays }) => {
  if (!env.forecastServiceUrl || !env.forecastServiceToken) throw new AppError(503, 'Chưa cấu hình dịch vụ dự báo Python');
  let response;
  try {
    response = await fetch(`${env.forecastServiceUrl.replace(/\/$/, '')}/forecast`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Service-Token': env.forecastServiceToken },
      body: JSON.stringify({ series, cutoff_date: cutoffDate, horizon_days: horizonDays }),
      signal: AbortSignal.timeout(env.forecastTimeoutMs)
    });
  } catch { throw new AppError(503, 'Không kết nối được dịch vụ Python trong thời gian cho phép'); }
  if (!response.ok) {
    let details;
    try { details = (await response.json()).detail; } catch { details = 'Dịch vụ không trả JSON hợp lệ'; }
    throw new AppError(response.status === 409 || response.status === 422 ? 409 : 503, 'Dịch vụ Python chưa thể dự báo', details);
  }
  let data;
  try { data = await response.json(); } catch { throw new AppError(502, 'Phản hồi dịch vụ Python không phải JSON'); }
  if (!Array.isArray(data.results) || data.results.length !== series.length) throw new AppError(502, 'Dịch vụ Python trả thiếu sản phẩm');
  const expected = new Map(series.map(item => [`${item.warehouse_code || '*'}::${item.sku}`, item]));
  for (const result of data.results) {
    const key = `${result.warehouse_code || '*'}::${result.sku}`;
    if (!expected.delete(key) || typeof result.model_name !== 'string' || !Array.isArray(result.quantities)
      || result.quantities.length !== horizonDays || result.quantities.some(value => !Number.isFinite(value) || value < 0 || value >= 1e12)) {
      throw new AppError(502, 'Dịch vụ Python trả SKU, phạm vi hoặc số lượng không hợp lệ');
    }

    const metric =
      result.evaluation?.comparisons?.[result.model_name]?.test;

    if (metric != null) {
      if (
        !Number.isInteger(metric.n) ||
        metric.n <= 0 ||
        !Number.isFinite(metric.sum_absolute_error) ||
        metric.sum_absolute_error < 0 ||
        !Number.isFinite(metric.sum_squared_error) ||
        metric.sum_squared_error < 0
      ) {
        throw new AppError(
          502,
          'Dịch vụ Python trả metric không hợp lệ'
        );
      }
    }
  }
  return data;
};
