# RevParMax API

Production-facing read API and MCP server for canonical RevParMax review data.

The legacy extract tables remain a migration source only. This app reads through Convex query functions that project canonical product tables such as companies, properties, audit records, room statistics, non-room revenue, payment records, competition data, budgets, and pace snapshot days.

## Run

```bash
bun --filter api start
```

Defaults:

- `REVPARMAX_API_HOST=127.0.0.1`
- `REVPARMAX_API_PORT=8788`
- `CONVEX_URL=http://127.0.0.1:3210`
- `REVPARMAX_API_TOKEN` optional bearer token for `/mcp` and data routes

Unauthenticated metadata routes:

- `GET /health`
- `GET /openapi.json`

Authenticated data routes and MCP endpoint:

- `POST /mcp`
- `GET /companies`
- `GET /companies/:companyId/properties`
- `GET /companies/:companyId/audits`
- `GET /audits/:auditId`
- `GET /audits/:auditId/paces`
- `GET /companies/:companyId/budgets/rooms`
- `GET /companies/:companyId/budgets/revenue`
- `GET /properties/:propertyId/pace/snapshot`
- `GET /properties/:propertyId/forecast/month`
