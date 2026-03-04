# 11. Key Architectural Decision Records (ADRs)

## ADR-011: PRD Onboarding Time Target — Resolved

**Decision:** The canonical onboarding time target is **< 30 minutes** (measurable success metric). The "< 20 minutes" figure in PRD §3 Goal 4 is an aspirational UX goal, not a testable acceptance criterion.

**Rationale:** PRD §3 Goals state "< 20 minutes" while the Success Metrics table states "< 30 minutes." These cannot both be the target. The metric table is the authoritative source for measurement. The 20-minute aspiration should be noted in UX guidance but not used as a pass/fail criterion.

**Action required:** Update PRD §3 Goal 4 to read "< 30 minutes (< 20 minutes aspirational)" for consistency with the metric table.

---

## ADR-001: Convex as Single Backend — No Separate API Server

**Decision:** All backend logic runs as Convex queries, mutations, and actions. No Hono/Express API server.

**Rationale:** Convex provides the database, real-time subscriptions, job scheduling, and file storage in one managed platform. Eliminates the operational overhead of managing PostgreSQL, Redis, BullMQ, and a separate API server at Phase 1 scale. TanStack Start server functions (`createServerFn`) handle the few cases requiring SSR server-side logic (auth token hydration).

**Consequence:** All business logic must be expressible as Convex function types. External API calls (LLM, malware scan) use `action` type. Uniqueness constraints are enforced in mutations via read-then-write (Convex's transaction isolation makes this safe).

---

## ADR-002: Uniqueness Enforced in Mutations (Not DB Constraints)

**Decision:** `(propertyId, auditDate)` uniqueness is enforced in the `createAuditRecord` mutation with a preceding query inside the same transaction.

**Rationale:** Convex does not support DB-level unique constraints. Convex's serializable transaction isolation ensures the read-then-write is safe. The ECH fix (property-level, not company-level) is applied here.

---

## ADR-003: Derived Metrics Computed, Never Stored

**Decision:** `roomRevenue`, `revpar`, `occupancy` are computed at query time.

**Rationale:** Prevents data inconsistency when source fields are corrected post-verification. Single source of truth in `roomStatistics.adr` × `roomStatistics.roomsOccupied`.

---

## ADR-004: Timezone-Aware Date Logic via `property.timezone`

**Decision:** All "today" date comparisons use `DateTime.fromMillis(Date.now(), { zone: property.timezone }).toISODate()`.

**Rationale:** ECH finding: server's UTC date may differ from property's local date, causing false missing-data warnings and incorrect status badges.

---

## ADR-005: Soft Deletes for Categories with Historical Data

**Decision:** Revenue categories with any associated `nonRoomRevenue` documents cannot be hard-deleted. Deletion sets `archivedAt`; archived categories are hidden from new entry but retained in history queries.

**Rationale:** ECH finding: hard-deleting a mapped category orphans historical revenue records and breaks the extractor profile for future uploads.

---

## ADR-006: Extraction Results Persisted for 24-Hour Resume

**Decision:** `extractionResults` documents are persisted in Convex with a 24-hour TTL, keyed by `importId`.

**Rationale:** ECH finding: closing the browser mid-verify loses extraction state, forcing re-upload and consuming extraction quota again. The verify flow loads by `importId`; returning users resume where they left off.

---

## ADR-007: Alert Re-Fire Logic Defined

**Decision:** Dismissed alerts have `refireAfter = dismissedAt + 7 days`. The nightly cron re-activates them if the underlying condition still holds. Pickup velocity alerts resolve when `pickupRate >= 50% of LY for 2 consecutive days`.

**Rationale:** ECH finding: no re-fire condition means persistent underperformance is silently suppressed after first dismissal. ECH finding: no resolution condition means pickup alerts never clear.

---

## ADR-008: Budget Interactive Controls Are Session-Only

**Decision:** Budget Occupancy / ADR adjustments in the Forecast view are held in component state and never written to Convex. Only an explicit "Save as budget" button triggers a mutation.

**Rationale:** PRD P1.20 explicit requirement. `beforeunload` warning added to prevent owner believing changes were saved (ECH).

---

## ADR-009: Fiscal Year Budget Lock

**Decision:** When a fiscal year is locked (explicit action or year begins), all budget rows for that year have `isOriginal: true` and `lockedAt` set. The lock is detected before allowing writes. Subsequent edits create Rolling Forecast records, not modifications to original.

**Rationale:** ECH finding: changing fiscal year start mid-year could destroy the read-only original budget baseline.

---

## ADR-010: `@convex-dev/react-query` for All Data Fetching

**Decision:** All Convex queries are consumed via `convexQuery()` from `@convex-dev/react-query`, not raw `useQuery` from the Convex React library.

**Rationale:** Consistent with the existing scaffold. React Query's cache + Convex's real-time subscriptions gives the verify flow and upload status screen live updates without polling, replacing the need for explicit WebSocket subscription management.

---

## ADR-012: Malware Scan Integration — Webhook Not Polling *(new in v1.2)*

**Decision:** GuardDuty Malware Protection results are received via SNS + EventBridge → `internalHttpAction` webhook registered in `http.ts`. The `runMalwareScan` action submits the file URL and stores the returned `scanJobId`; it does not poll for results.

**Rationale:** AWS GuardDuty Malware Protection delivers scan findings as asynchronous events via SNS/EventBridge. There is no synchronous poll endpoint. The v1.1 architecture described polling from a Convex action, which would have received no response and caused all uploads to time out at 15 seconds with `scan_failed`, blocking the entire extraction pipeline. A 5-minute cron (`scan-timeout-guard`) provides the safety net for webhook delivery failures.

**Consequence:** `http.ts` gains a new POST route `/api/malware-scan-result`. The route must validate the webhook signature before processing. `dataImports` schema gains `scanJobId` field and a `by_scanStatus_creationTime` index for the timeout guard cron.

---

## ADR-013: Property Slug Uniqueness Scoped to Company *(new in v1.2)*

**Decision:** The property slug uniqueness constraint is `(companyId, slug)`, not global slug. The `properties` table index is changed from `by_slug: ["slug"]` to `by_companyId_slug: ["companyId", "slug"]`. The `createProperty` mutation uniqueness check uses `.eq('companyId', profile.companyId).eq('slug', slug)`.

**Rationale:** Two different hotel ownership companies may independently operate properties with the same name (e.g. "Riverport Inn"). A global slug uniqueness constraint would silently deny the second company's property creation, or — worse — allow slug collision where route parameter `/:propertyId` resolves to different properties for different tenants depending on lookup order.

**Consequence:** Property URLs use `/:propertyId` (the Convex `_id`), not `/:slug`. Slugs are used only for file naming purposes (filenames are company-scoped by property association). No cross-tenant data access risk via route params.

---

## ADR-014: Explicit `onUserCreate` Hook for Profile Initialization *(new in v1.2)*

**Decision:** A `onUserCreate` callback in `auth.ts` creates a placeholder `userProfile` document (role: `"pending_onboarding"`, no `companyId`) atomically with Better Auth user creation. The `userProfiles` schema is updated: `companyId` becomes optional; `"pending_onboarding"` is added as a valid role value. All Convex functions reject `pending_onboarding` profiles before accessing data, redirecting to onboarding completion.

**Rationale:** The v1.1 architecture relied on the client-side onboarding wizard to create the `userProfile` document. If sign-up succeeded but the initial onboarding mutation failed (network error, Convex unavailable, user closed the tab), the authenticated user would be permanently locked out — every Convex call throws `"No profile"` with no recovery path. By creating the profile at the authentication layer, the profile is guaranteed to exist for any authenticated user.

**Consequence:** `userProfiles.companyId` must be checked for null in all queries that join on it. The onboarding wizard's `completeOnboarding` mutation updates the placeholder profile with the real `companyId` and `role`.

---

## ADR-015: Churned Property Deletion Order Specified *(new in v1.2)*

**Decision:** Churned property document deletion executes in a fixed sequential order (see §10 Data Retention), implemented as a chain of scheduled batch mutations. No step begins before its predecessor commits.

**Rationale:** The v1.1 architecture specified "90-day retention cron deletes documents" without defining order. If a Convex query runs concurrently with mid-deletion state (e.g. `auditRecords` deleted but `roomStatistics` still present), it returns partial data with no indication of incompleteness. Defining order ensures that at any observable state, the data is consistent: either all child records exist, or the parent record is already gone and the query returns nothing.

**Consequence:** The deletion cron is decomposed into 16 sequential steps. Each step is an `internalMutation` that deletes a single table's records for the property in batches (Convex mutation document limit applies). Steps are chained via `ctx.scheduler.runAfter`. Total deletion time for a mature property may be several minutes; this is acceptable for a background churn process.

---
