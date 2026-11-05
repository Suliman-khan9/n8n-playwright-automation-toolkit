# n8n Playwright Automation Toolkit

A small, **read-only** command-line health checker for self-hosted [n8n](https://n8n.io/) instances and Chrome/Chromium browsers used by [Playwright](https://playwright.dev/) via the Chrome DevTools Protocol (CDP).

> Status: **v0.1.0 — early project**. This is a working starting point, not a full workflow orchestration or browser-repair system. Contributions and issue reports are welcome.

## Why this exists

Automation operators often need to determine whether the **n8n service** or a **browser CDP port** is reachable before investigating more complex workflow failures. This utility gives a predictable exit code and optional JSON output, without creating sessions, touching tabs, modifying workflows, or accessing credentials.

## Requirements

- Node.js **20 or later**
- An accessible n8n instance and/or Chromium browser with a CDP debugging port
- No npm dependencies, API keys, or account credentials required

## Quick start

Clone the repository, then run:

```bash
node src/cli.js --n8n http://127.0.0.1:5678 --cdp http://127.0.0.1:9471
```

Check only one service:

```bash
node src/cli.js --n8n http://127.0.0.1:5678 --json
```

Add retry and timeout settings:

```bash
node src/cli.js --cdp http://127.0.0.1:9471 --retries 2 --timeout-ms 8000
```

Example output (illustrative):

```text
OK   N8N http://127.0.0.1:5678/healthz (19ms, 1 attempt(s))
OK   CDP http://127.0.0.1:9471/json/version (8ms, 1 attempt(s))
```

## What is checked?

| Service | Read-only endpoint | Success condition |
|---|---|---|
| n8n | `GET /healthz` | HTTP 2xx response |
| Chromium CDP | `GET /json/version` | HTTP 2xx with a `Browser` version field |

**Important:** A successful health check means the endpoint is responding. It does **not** prove that a workflow, browser automation script, or login session will work end-to-end. Some n8n installations may use reverse proxies or custom base paths; supply the correct accessible base URL.

## Exit codes and automation

- `0`: all selected checks succeeded
- `1`: at least one check failed
- `2`: invalid command-line arguments

`--json` gives a structured report with `healthy`, `checkedAt`, and a `results` array. It can be used by schedulers, scripts, CI checks, and log collectors.

## Tests

```bash
npm test
npm run lint
```

Tests use the built-in Node.js test runner and temporary local HTTP servers. No real n8n or browser process is needed for these tests.

## Security and privacy

- This tool **never** launches or closes browser processes, changes browser tabs, triggers workflows, or sends credentials.
- Avoid exposing your CDP debugging port to the public internet; use local-only ports.
- URL credentials, query strings and fragments are intentionally rejected.
- No telemetry or external analytics.

See [Security notes](docs/security.md) and [Contributing](CONTRIBUTING.md).

## Roadmap

- [x] n8n and CDP read-only health checks
- [x] Retry/timeout settings, JSON mode, test suite and CI
- [ ] Optional periodic monitoring and history export
- [ ] Documented diagnostic profiles for common n8n / Playwright setups
- [ ] Additional non-destructive diagnostics, after testing and feedback

## License

MIT. This is an independent community project, not affiliated with OpenAI, n8n, or Microsoft Playwright.
