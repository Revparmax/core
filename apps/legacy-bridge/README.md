# RevParMax Legacy Bridge

Local read-only OpenAPI and MCP bridge for the Convex legacy seed.

## Startup

Start local Convex from the repo root:

```bash
cd packages/backend
CONVEX_AGENT_MODE=anonymous bunx convex dev --typecheck disable --tail-logs disable
```

The default local Convex URL is `http://127.0.0.1:3210`.

Import and canonicalize the read model:

```bash
cd packages/backend
bun run legacy:canonicalize-read-model
```

Start the bridge:

```bash
bun --filter legacy-bridge start
```

Defaults:

- Bridge URL: `http://127.0.0.1:8787`
- Pace inspector: `http://127.0.0.1:8787/inspector`
- OpenAPI: `http://127.0.0.1:8787/openapi.json`
- MCP Streamable HTTP: `http://127.0.0.1:8787/mcp`

Audit detail responses read canonical RevParMax tables populated by
`legacy:canonicalize-read-model`: `auditRecords`, `roomStatistics`,
`nonRoomRevenue`, `paymentRecords`, `competitionData`, `budgets`, and
`paceSnapshotDays`. The `legacy*` tables are only the frozen extract layer for
conversion and are not queried by the bridge for normalized app data. Full pace
reads remain paginated through `/audits/{auditId}/paces` and the
`get_audit_paces` MCP tool.

Legacy users and hurdle rates are not projected yet because the product schema
does not currently have canonical tables for them. Their bridge endpoints return
empty lists until those schemas are defined.

## Environment

- `CONVEX_URL`: Convex backend URL. Defaults to `http://127.0.0.1:3210`.
- `HOST`: Bridge bind host. Defaults to `127.0.0.1`.
- `PORT`: Bridge port. Defaults to `8787`.
- `LEGACY_API_TOKEN`: Optional bearer token for all routes except `/health` and `/openapi.json`.

## Smoke Checks

With Convex and the bridge running:

```bash
bun --filter legacy-bridge smoke
bun --filter legacy-bridge smoke:mcp
```

The REST smoke checks OpenAPI, audit `20265`, users without password hashes,
and canonical pace pagination. The MCP smoke checks that the same query layer is
reachable through Streamable HTTP.
