# Security notes

This utility makes read-only HTTP GET requests to the URLs supplied by the user. It deliberately does not store any secrets, request login credentials, read browser profiles, or automate browser interactions.

## Safe usage

- Bind Chrome/Chromium's remote debugging endpoint to `127.0.0.1`; CDP is powerful and must not be publicly exposed.
- Do not put access tokens or passwords in the command line. URL query strings and embedded credentials are rejected.
- Prefer HTTPS for remote n8n endpoints where possible.
- Treat reports as operational metadata: hostnames and ports may be sensitive in some environments.
- The check uses a single HTTP GET per attempt and follows no redirects.

## Non-goals

The tool does not verify authenticated n8n API operations, Playwright scripts, complete workflow executions, service performance, account permissions, or end-to-end UI actions. A green health check is not a guarantee of a healthy automation system.

To report a vulnerability, open a GitHub security advisory or contact the maintainer privately rather than posting exploit details in a public issue.
