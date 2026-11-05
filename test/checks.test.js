import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { checkService, checkAll, buildEndpoint } from '../src/checks.js';

async function withServer(handler, run) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { return await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('normalizes base URL with or without trailing slash', () => {
  assert.equal(buildEndpoint('http://localhost:5678/', '/healthz'), 'http://localhost:5678/healthz');
  assert.equal(buildEndpoint('http://localhost:5678/prefix/', '/healthz'), 'http://localhost:5678/prefix/healthz');
});

test('rejects URLs containing credentials or query strings', () => {
  assert.throws(() => buildEndpoint('http://user:pass@localhost/', '/healthz'));
  assert.throws(() => buildEndpoint('http://localhost/?token=abc', '/healthz'));
});

test('recognizes a healthy n8n /healthz endpoint', async () => {
  await withServer((req, res) => {
    assert.equal(req.url, '/healthz');
    res.writeHead(200).end('ok');
  }, async (baseUrl) => {
    const result = await checkService({ service: 'n8n', baseUrl, retries: 0 });
    assert.equal(result.status, 'ok');
    assert.equal(result.httpStatus, 200);
  });
});

test('marks unhealthy n8n endpoint as failed', async () => {
  await withServer((_req, res) => res.writeHead(503).end('unhealthy'), async (baseUrl) => {
    const result = await checkService({ service: 'n8n', baseUrl, retries: 0 });
    assert.equal(result.status, 'fail');
    assert.match(result.error, /HTTP 503/);
  });
});

test('validates Chromium CDP /json/version payload', async () => {
  await withServer((req, res) => {
    assert.equal(req.url, '/json/version');
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ Browser: 'Chrome/123' }));
  }, async (baseUrl) => {
    const result = await checkService({ service: 'cdp', baseUrl, retries: 0 });
    assert.equal(result.status, 'ok');
  });
});

test('rejects malformed CDP payload', async () => {
  await withServer((_req, res) => res.writeHead(200, { 'content-type': 'application/json' }).end('{}'), async (baseUrl) => {
    const result = await checkService({ service: 'cdp', baseUrl, retries: 0 });
    assert.equal(result.status, 'fail');
    assert.match(result.error, /Browser version/);
  });
});

test('retries failed checks and succeeds when service recovers', async () => {
  let calls = 0;
  await withServer((_req, res) => {
    calls++;
    res.writeHead(calls === 1 ? 503 : 200).end('ok');
  }, async (baseUrl) => {
    const result = await checkService({ service: 'n8n', baseUrl, retries: 1, retryDelayMs: 5 });
    assert.equal(result.status, 'ok');
    assert.equal(result.attempts, 2);
  });
});

test('aggregates n8n and CDP check results', async () => {
  await withServer((req, res) => {
    if (req.url === '/healthz') res.writeHead(200).end('ok');
    else res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ Browser: 'Chromium/123' }));
  }, async (baseUrl) => {
    const result = await checkAll({ n8n: baseUrl, cdp: baseUrl, timeoutMs: 5000, retries: 0 });
    assert.equal(result.healthy, true);
    assert.equal(result.results.length, 2);
  });
});
