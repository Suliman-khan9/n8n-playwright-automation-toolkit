#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { checkAll } from './checks.js';

const usage = `Automation Health — read-only n8n and Chromium CDP checks

Usage:
  node src/cli.js --n8n http://127.0.0.1:5678 --cdp http://127.0.0.1:9471
  node src/cli.js --n8n http://127.0.0.1:5678 --json

Options:
  --n8n URL          Base URL of an n8n instance (GET /healthz)
  --cdp URL          Base URL of a Chromium debug port (GET /json/version)
  --timeout-ms N     Request timeout in milliseconds, 100–60000 (default 5000)
  --retries N        Extra attempts after a failure, 0–5 (default 1)
  --json             Print machine-readable JSON
  --help             Show this usage

Exit codes: 0 healthy, 1 check failed, 2 invalid arguments.
`;

function parseInteger(name, value, low, high) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < low || number > high) {
    throw new RangeError(`${name} must be an integer from ${low} to ${high}`);
  }
  return number;
}

async function main() {
  try {
    const { values } = parseArgs({
      options: {
        n8n: { type: 'string' }, cdp: { type: 'string' },
        'timeout-ms': { type: 'string', default: '5000' },
        retries: { type: 'string', default: '1' },
        json: { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
      },
      strict: true,
    });
    if (values.help) { process.stdout.write(usage); return; }
    const timeoutMs = parseInteger('timeout-ms', values['timeout-ms'], 100, 60000);
    const retries = parseInteger('retries', values.retries, 0, 5);
    const report = await checkAll({ n8n: values.n8n, cdp: values.cdp, timeoutMs, retries });
    if (values.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      for (const entry of report.results) {
        const label = entry.status === 'ok' ? 'OK  ' : 'FAIL';
        process.stdout.write(`${label} ${entry.service.toUpperCase()} ${entry.endpoint} (${entry.latencyMs}ms, ${entry.attempts} attempt(s))${entry.error ? ` — ${entry.error}` : ''}\n`);
      }
    }
    if (!report.healthy) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`Error: ${error.message}\n\n${usage}`);
    process.exitCode = 2;
  }
}

await main();
