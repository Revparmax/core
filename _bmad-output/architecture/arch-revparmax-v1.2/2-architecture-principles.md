# 2. Architecture Principles

1. **Convex is the only backend.** No separate API server. All business logic lives in Convex queries, mutations, and actions.
2. **Tenant isolation is enforced in every Convex function.** Every function resolves `companyId` and `propertyId` from the authenticated user before touching any data. No function accepts these as untrusted client arguments.
3. **Fail loud at ingestion, never silently.** Every pipeline failure produces a user-visible error and a persisted log entry in Convex.
4. **Derived fields are never stored.** `roomRevenue`, `revpar`, `occupancy` are computed at query time — never written to the database.
5. **Idempotency at the pipeline level.** Re-submitting the same file for the same audit date triggers an explicit overwrite confirmation, not silent replacement.
6. **Timezone-aware throughout.** All "today" logic uses `property.timezone`. The server stores UTC; date boundaries are computed per-property.
7. **Reactive by default.** Convex queries are live subscriptions via `@convex-dev/react-query`. The verify flow and upload status screen update in real time without polling.

---
