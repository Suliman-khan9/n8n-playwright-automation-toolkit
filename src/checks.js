/**
 * Dependency-free, read-only HTTP health checks for n8n and Chromium CDP.
 * These checks never authenticate, alter browser tabs, or call n8n workflows.
 */

function normalizeBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError('Endpoint must be an absolute http(s) URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new TypeError('Only http and https endpoints are supported');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new TypeError('URLs must not include credentials, query strings, or fragments');
  }
  return url;
}

export function buildEndpoint(base, path) {
  const url = normalizeBaseUrl(base);
  url.pathname = `${url.pathname.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  return url.toString();
}

function publicEndpoint(urlString) {
  const url = new URL(urlString);
  return `${url.origin}${url.pathname}`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @returns {Promise<{service:string,status:string,endpoint:string,httpStatus?:number,latencyMs:number,attempts:number,error?:string}>} */
export async function checkService({ service, baseUrl, path, timeoutMs = 5000, retries = 0, fetchImpl = fetch, retryDelayMs = 250 }) {
  if (!['n8n', 'cdp'].includes(service)) throw new TypeError('Unsupported service');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60000) throw new RangeError('timeoutMs must be 100–60000');
  if (!Number.isInteger(retries) || retries < 0 || retries > 5) throw new RangeError('retries must be 0–5');
  const endpoint = buildEndpoint(baseUrl, path ?? (service === 'n8n' ? '/healthz' : '/json/version'));
  const started = performance.now();
  let lastError = 'Unknown error';
  let httpStatus;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const response = await fetchImpl(endpoint, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
      httpStatus = response.status;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (service === 'cdp') {
        const body = await response.json();
        if (!body || typeof body.Browser !== 'string' || body.Browser.length === 0) {
          throw new Error('CDP response does not contain Browser version');
        }
      } else {
        await response.body?.cancel();
      }
      return {
        service, status: 'ok', endpoint: publicEndpoint(endpoint), httpStatus,
        latencyMs: Math.round(performance.now() - started), attempts: attempt,
      };
    } catch (error) {
      // Never print the original URL, request headers or any response body.
      lastError = error instanceof Error ? error.message : 'Request failed';
      if (attempt <= retries) await sleep(retryDelayMs);
      else return {
        service, status: 'fail', endpoint: publicEndpoint(endpoint),
        ...(httpStatus !== undefined ? { httpStatus } : {}),
        latencyMs: Math.round(performance.now() - started), attempts: attempt,
        error: lastError,
      };
    }
  }
}

export async function checkAll(options) {
  const checks = [];
  if (options.n8n) checks.push({ service: 'n8n', baseUrl: options.n8n });
  if (options.cdp) checks.push({ service: 'cdp', baseUrl: options.cdp });
  if (checks.length === 0) throw new TypeError('Provide --n8n and/or --cdp');
  const results = await Promise.all(checks.map((item) => checkService({ ...item, timeoutMs: options.timeoutMs, retries: options.retries })));
  return { healthy: results.every((r) => r.status === 'ok'), checkedAt: new Date().toISOString(), results };
}
