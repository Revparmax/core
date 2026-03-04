# Architecture Document — RevParMax v1

**Version:** 1.1
**Date:** 2026-03-03
**Status:** Draft
**Sources:**
- `_bmad-output/prd/prd-revparmax-v1.md` (v1.1)
- `_bmad-output/reviews/ech-prd-revparmax-v1-2026-03-03.json` (55 edge cases)
- `_bmad-output/reviews/adversarial-arch-revparmax-2026-03-03.md` (15 findings)
- Existing scaffold: TanStack Start + Convex + Better Auth (Better T Stack)

**v1.1 Changes:**
- Fixed paceSnapshot storage scale (was 73x underestimated)
- Added AI Extraction Specification (§8a) — previously absent for highest-risk component
- Added Forecast Algorithm Specification (§8b)
- Clarified onboarding time target discrepancy (PRD contradiction noted)
- Added malware scan vendor decision (AWS Malware Protection)
- Added Phase 1 compute cost estimate

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Principles](#2-architecture-principles)
3. [Tech Stack](#3-tech-stack)
4. [Monorepo Structure](#4-monorepo-structure)
5. [Convex Backend Architecture](#5-convex-backend-architecture)
6. [Convex Data Schema](#6-convex-data-schema)
7. [Frontend Architecture (TanStack Start)](#7-frontend-architecture-tanstack-start)
8. [AI Ingestion Pipeline](#8-ai-ingestion-pipeline)
8a. [AI Extraction Specification](#8a-ai-extraction-specification) *(new in v1.1)*
8b. [Forecast Algorithm Specification](#8b-forecast-algorithm-specification) *(new in v1.1)*
9. [Security Architecture](#9-security-architecture)
10. [Infrastructure & Deployment](#10-infrastructure--deployment)
11. [Key Architectural Decision Records (ADRs)](#11-key-architectural-decision-records-adrs)
12. [Edge Case Guards — Implementation Map](#12-edge-case-guards--implementation-map)

---

## 1. System Overview

RevParMax is a multi-tenant SaaS platform for hotel ownership groups. It ingests nightly audit reports from property management systems (PMS), extracts structured data via an AI pipeline, and surfaces operational intelligence through an owner dashboard.

### System Boundaries

```
┌──────────────────────────────────────────────────────────────┐
│                       RevParMax Platform                     │
│                                                              │
│  ┌────────────────────────────┐   ┌─────────────────────┐   │
│  │   TanStack Start (SSR)     │   │   Convex Backend    │   │
│  │                            │   │                     │   │
│  │  - File-based routing      │◄──│  - Queries          │   │
│  │  - Server functions        │   │  - Mutations        │   │
│  │  - React 19 + TQ           │   │  - Actions (AI)     │   │
│  │  - ConvexBetterAuthProvider│   │  - Cron jobs        │   │
│  └────────────────────────────┘   │  - File storage     │   │
│                                   │  - Better Auth      │   │
│                                   └─────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
         ▲                                    ▲
   Night Auditors                        Hotel Owners
   (upload + verify)                     (dashboard)
```

### User Roles (PRD §4)

| Role | Scope | Primary Surface |
|------|-------|-----------------|
| Owner / Ownership Group | Portfolio — all properties | Dashboard, Forecast, Budget, Alerts |
| Night Auditor | Single property | Upload + Verify flow only |
| General Manager | Single property | Full property view, Settings, Onboarding |

### Key Constraints

- **Phase 1:** Single nightly source per property per day; multi-source is a future extension
- **Single currency:** USD only (V1)
- **No channel management:** analytics and forecasting layer only; no rate pushing
- **Tenant isolation:** No cross-property data access; auditors scoped to one property
- **Scale target:** 500+ properties without schema changes

---

## 2. Architecture Principles

1. **Convex is the only backend.** No separate API server. All business logic lives in Convex queries, mutations, and actions.
2. **Tenant isolation is enforced in every Convex function.** Every function resolves `companyId` and `propertyId` from the authenticated user before touching any data. No function accepts these as untrusted client arguments.
3. **Fail loud at ingestion, never silently.** Every pipeline failure produces a user-visible error and a persisted log entry in Convex.
4. **Derived fields are never stored.** `roomRevenue`, `revpar`, `occupancy` are computed at query time — never written to the database.
5. **Idempotency at the pipeline level.** Re-submitting the same file for the same audit date triggers an explicit overwrite confirmation, not silent replacement.
6. **Timezone-aware throughout.** All "today" logic uses `property.timezone`. The server stores UTC; date boundaries are computed per-property.
7. **Reactive by default.** Convex queries are live subscriptions via `@convex-dev/react-query`. The verify flow and upload status screen update in real time without polling.

---

## 3. Tech Stack

### Frontend

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | TanStack Start (React 19) | SSR, file-based routing, `createServerFn` |
| Routing | TanStack Router | File-based, type-safe, code-split by route |
| Server state | TanStack Query + `@convex-dev/react-query` | Convex queries exposed as React Query subscriptions |
| Forms | TanStack Form + Zod | Type-safe, minimal re-renders |
| UI Components | shadcn/ui (Radix primitives) | Accessible, unstyled base; already scaffolded |
| Charts | Recharts | Declarative, composable, React-native |
| Styling | Tailwind CSS v4 | Already configured |
| Notifications | Sonner | Already configured |
| Auth client | Better Auth + `convexClient()` plugin | Token passed to Convex via `ConvexBetterAuthProvider` |

### Backend (Convex)

| Layer | Choice | Notes |
|-------|--------|-------|
| Runtime | Convex | Serverless functions (query / mutation / action) |
| Database | Convex (document store) | Reactive, TypeScript-typed schema |
| Auth | Better Auth + `@convex-dev/better-auth` | Component registered in `convex.config.ts` |
| File Storage | Convex Storage | `generateUploadUrl` → direct upload → `storageId` |
| Job Scheduling | Convex Scheduler + Crons | Replaces Redis/BullMQ |
| AI / LLM | Claude claude-sonnet-4-6 (Anthropic) | Called from Convex actions |
| Validation | Zod (shared with frontend) | Used in action arg validators |

### Monorepo Tooling

| Tool | Purpose |
|------|---------|
| Bun | Package manager + runtime |
| Turborepo | Monorepo task orchestration |
| Ultracite (Biome) | Lint + format (already configured) |
| Husky + lint-staged | Pre-commit hooks |
| TypeScript 5 | Shared types across packages |

---

## 4. Monorepo Structure

```
revparmax/
├── apps/
│   └── web/                          # TanStack Start app
│       ├── src/
│       │   ├── routes/               # File-based routes
│       │   ├── components/           # Shared UI components
│       │   └── lib/                  # auth-client, utils
│       └── vite.config.ts
│
├── packages/
│   ├── backend/                      # Convex backend
│   │   └── convex/
│   │       ├── schema.ts             # All table definitions
│   │       ├── convex.config.ts      # App + component registration
│   │       ├── auth.ts               # Better Auth setup
│   │       ├── auth.config.ts        # Auth config
│   │       ├── http.ts               # HTTP router (Better Auth handler)
│   │       ├── crons.ts              # Scheduled jobs
│   │       ├── _generated/           # Auto-generated types
│   │       └── [feature]/            # Feature modules (see §5)
│   ├── config/                       # Shared TS config
│   └── env/                          # Typed env vars (t3-env)
│
├── package.json                      # Root workspace (Bun)
├── turbo.json
└── biome.jsonc
```

---

## 5. Convex Backend Architecture

### Function Types

| Type | Use | Notes |
|------|-----|-------|
| `query` | Read data, reactive subscription | Called from React via `useQuery` / React Query |
| `mutation` | Transactional writes | Atomic across multiple tables in one call |
| `action` | External API calls (AI, file scan) | Not reactive; triggers mutations to write results |
| `internalQuery/Mutation/Action` | Called server-to-server only | Not exposed to client |
| `httpAction` | HTTP endpoint | Used for Better Auth routes |

### Feature Module Layout

```
packages/backend/convex/
├── schema.ts
├── convex.config.ts
├── auth.ts / auth.config.ts
├── http.ts
├── crons.ts
│
├── companies/
│   ├── queries.ts        # getMyCompany, getCompanyProperties
│   └── mutations.ts      # createCompany
│
├── properties/
│   ├── queries.ts        # getProperty, listPropertiesForCompany
│   └── mutations.ts      # createProperty, updateProperty, updateStatus
│
├── onboarding/
│   └── mutations.ts      # saveWizardStep, completeOnboarding
│
├── uploads/
│   ├── queries.ts        # getImportStatus, getLastSubmission
│   ├── mutations.ts      # recordUpload, markScanResult
│   └── actions.ts        # triggerMalwareScan, triggerExtraction
│
├── ingestion/
│   ├── actions.ts        # runExtraction (calls Claude), runFileParse
│   └── mutations.ts      # saveExtractionResult, saveExtractionFailure
│
├── verify/
│   ├── queries.ts        # getExtractionForVerify (reactive)
│   └── mutations.ts      # confirmVerify, submitCorrection
│
├── auditRecords/
│   ├── queries.ts        # getAuditRecord, getAuditHistory
│   └── mutations.ts      # createAuditRecord, overwriteAuditRecord
│
├── dashboard/
│   └── queries.ts        # getOwnerDashboard (KPI bar, LY vs TY, targets)
│
├── history/
│   ├── rooms.ts          # getRoomsHistory
│   ├── nonRooms.ts       # getNonRoomsHistory
│   ├── competition.ts    # getCompetitionHistory
│   └── payments.ts       # getPaymentsHistory
│
├── forecast/
│   ├── queries.ts        # getForecastChart, getDayByDayTable, getProjection
│   └── mutations.ts      # saveBudget, invalidateForecastCache
│
├── budget/
│   ├── queries.ts        # getBudget, getRollingForecast
│   └── mutations.ts      # saveBudgetEntry, lockOriginalBudget, importBudgetCsv
│
├── alerts/
│   ├── queries.ts        # getActiveAlerts, getAlertDetail
│   ├── mutations.ts      # dismissAlert, resolveAlert
│   └── internal.ts       # evaluateVarianceAlerts, evaluatePickupAlerts (internalMutation)
│
├── settings/
│   ├── queries.ts        # getPropertySettings, getCategories, getExtractorProfile
│   └── mutations.ts      # updateSettings, createCategory, archiveCategory,
│                         #   updateExtractorProfile, reassignAuditor
│
└── files/
    ├── queries.ts        # listFiles, getFileUrl
    └── mutations.ts      # deleteFileRecord
```

### Cron Jobs (`crons.ts`)

```typescript
// Nightly alert evaluation — runs at 6am per property timezone
// (approximated as UTC; property-specific scheduling in Phase 2)
crons.daily("evaluate-variance-alerts", { hourUTC: 10 }, internal.alerts.evaluateVarianceAlerts);
crons.daily("evaluate-pickup-alerts",   { hourUTC: 10 }, internal.alerts.evaluatePickupAlerts);

// Living snapshot archival — triggered after each verified submission via scheduler,
// not as a cron (immediate, per submission)

// Re-fire dismissed alerts — daily sweep for snoozed alerts past their re_fire_after date
crons.daily("refire-dismissed-alerts", { hourUTC: 10 }, internal.alerts.refireSnoozedAlerts);
```

### Scheduled Functions (Scheduler)

Used for async pipeline steps that shouldn't block the upload response:

```typescript
// In uploads/actions.ts — after scan passes:
await ctx.scheduler.runAfter(0, internal.ingestion.runExtraction, { importId });

// In verify/mutations.ts — after verified submission:
await ctx.scheduler.runAfter(0, internal.forecast.invalidateCache, { propertyId, auditDate });
await ctx.scheduler.runAfter(0, internal.paceSnapshots.archiveSnapshot, { propertyId, auditDate });
await ctx.scheduler.runAfter(0, internal.alerts.evaluateForProperty, { propertyId });
```

---

## 6. Convex Data Schema

Convex uses a document model. Tables have `_id: Id<"tableName">` and `_creationTime` automatically. All relationships are stored as `Id<"tableName">` references. Indexes are defined per table.

### `companies`

```typescript
defineTable({
  name: v.string(),                    // validated: trim().length > 0
})
.index("by_name", ["name"])
```

### `userProfiles`

Bridges Better Auth users (managed by the `betterAuth` component) to RevParMax companies and properties.

```typescript
defineTable({
  userId: v.string(),                  // Better Auth user ID
  companyId: v.id("companies"),
  propertyId: v.optional(v.id("properties")), // required for auditor role
  role: v.union(
    v.literal("owner"),
    v.literal("gm"),
    v.literal("auditor")
  ),
})
.index("by_userId", ["userId"])
.index("by_companyId", ["companyId"])
```

### `properties`

```typescript
defineTable({
  companyId: v.id("companies"),
  name: v.string(),                    // validated: trim().length > 0
  slug: v.string(),                    // derived from trimmed name; unique enforced in mutation
  totalRooms: v.number(),             // validated: >= 1 (ECH: div-by-zero guard)
  timezone: v.string(),               // e.g. "America/New_York" (ECH: required)
  status: v.union(
    v.literal("pending_first_upload"),
    v.literal("active"),
    v.literal("inactive")
  ),
  // Alert thresholds (configurable per property)
  varianceThresholdPct: v.number(),   // default 10; validated >= 1 (ECH: 0% → alert spam)
  varianceConsecutiveDays: v.number(),// default 3
  paceYellowThresholdPct: v.number(), // default 10; validated > redThreshold (ECH)
  paceRedThresholdPct: v.number(),    // default 10
  pickupVelocityThresholdPct: v.number(), // default 50
})
.index("by_companyId", ["companyId"])
.index("by_slug", ["slug"])
```

### `dataImports`

```typescript
defineTable({
  propertyId: v.id("properties"),
  companyId: v.id("companies"),
  originalFilename: v.string(),
  storedFilename: v.string(),         // slug-type-date-nanoid4 format (ECH: collision suffix)
  storageId: v.optional(v.id("_storage")), // Convex storage ID
  fileSizeBytes: v.number(),          // validated: < 50_000_000 (ECH: strictly less than)
  mimeType: v.string(),
  scanStatus: v.union(
    v.literal("pending"),
    v.literal("clean"),
    v.literal("infected"),
    v.literal("scan_failed")          // ECH: scan_failed → rejected, never proceeds
  ),
  extractionStatus: v.union(
    v.literal("pending"),
    v.literal("in_progress"),
    v.literal("completed"),
    v.literal("failed"),
    v.literal("timeout")
  ),
  extractionId: v.optional(v.string()),
  extractedAt: v.optional(v.number()),
  uploadedBy: v.string(),             // Better Auth user ID
})
.index("by_propertyId", ["propertyId"])
.index("by_extractionStatus", ["propertyId", "extractionStatus"])
```

### `auditRecords`

```typescript
defineTable({
  propertyId: v.id("properties"),
  companyId: v.id("companies"),
  auditDate: v.string(),              // "YYYY-MM-DD" in property's local timezone
  source: v.union(v.literal("upload"), v.literal("manual")),
  status: v.union(
    v.literal("draft"),
    v.literal("pending_verification"),
    v.literal("verified"),
    v.literal("overwritten")
  ),
  dataImportId: v.optional(v.id("dataImports")),
  submittedBy: v.string(),
  verifiedBy: v.optional(v.string()),
  verifiedAt: v.optional(v.number()),
})
.index("by_propertyId_date", ["propertyId", "auditDate"]) // enforces one-per-date at mutation level
.index("by_companyId", ["companyId"])
```

> **Note:** Convex does not enforce unique constraints at the DB layer. Uniqueness on `(propertyId, auditDate)` is enforced in the `createAuditRecord` mutation using a preceding query + conditional write (Convex transactions guarantee isolation). This is the standard Convex pattern.

### `roomStatistics`

```typescript
defineTable({
  auditId: v.id("auditRecords"),
  propertyId: v.id("properties"),
  roomsOccupied: v.number(),         // >= 0
  adr: v.number(),                   // >= 0
  // roomRevenue is NEVER stored — derived as adr * roomsOccupied at query time
  sameDayCancellations: v.number(),
  noShows: v.number(),
  compRooms: v.number(),
  oooRooms: v.number(),
})
.index("by_auditId", ["auditId"])
.index("by_propertyId", ["propertyId"])
```

### `revenueParentCategories`

```typescript
defineTable({
  propertyId: v.id("properties"),
  companyId: v.id("companies"),
  name: v.string(),
  displayOrder: v.number(),
  archivedAt: v.optional(v.number()), // ECH: soft delete, not hard delete
})
.index("by_propertyId", ["propertyId"])
```

### `revenueCategories`

```typescript
defineTable({
  propertyId: v.id("properties"),
  companyId: v.id("companies"),
  parentId: v.optional(v.id("revenueParentCategories")),
  name: v.string(),
  displayOrder: v.number(),
  archivedAt: v.optional(v.number()), // ECH: blocked from hard-delete if has history
})
.index("by_propertyId", ["propertyId"])
.index("by_propertyId_name", ["propertyId", "name"]) // uniqueness checked in mutation (case-insensitive)
```

### `nonRoomRevenue`

```typescript
defineTable({
  auditId: v.id("auditRecords"),
  propertyId: v.id("properties"),
  categoryId: v.id("revenueCategories"),
  amount: v.number(),                 // negatives allowed (refunds) (ECH)
  source: v.string(),
})
.index("by_auditId", ["auditId"])
.index("by_propertyId_categoryId", ["propertyId", "categoryId"])
```

### `paymentTypes`

```typescript
defineTable({
  propertyId: v.optional(v.id("properties")), // null = global default
  name: v.string(),
  isDefault: v.boolean(),
  archivedAt: v.optional(v.number()),
})
.index("by_propertyId", ["propertyId"])
```

### `paymentRecords`

```typescript
defineTable({
  auditId: v.id("auditRecords"),
  propertyId: v.id("properties"),
  paymentTypeId: v.id("paymentTypes"),
  amount: v.number(),
  source: v.string(),
})
.index("by_auditId", ["auditId"])
```

### `competitors`

```typescript
defineTable({
  propertyId: v.id("properties"),
  name: v.string(),
  totalRooms: v.optional(v.number()),
  archivedAt: v.optional(v.number()),
})
.index("by_propertyId", ["propertyId"])
```

### `competitionData`

```typescript
defineTable({
  auditId: v.id("auditRecords"),
  propertyId: v.id("properties"),
  competitorId: v.id("competitors"),
  rate: v.optional(v.number()),
  availableRooms: v.optional(v.number()),
  dailyOccupancy: v.optional(v.number()), // 0.0 to 1.0
})
.index("by_auditId", ["auditId"])
.index("by_competitorId_auditId", ["competitorId", "auditId"])
```

### `paceSnapshots` (The Living Snapshot)

```typescript
defineTable({
  propertyId: v.id("properties"),
  snapshotDate: v.string(),           // date the snapshot was captured ("YYYY-MM-DD")
  forecastDate: v.string(),           // the forward-looking date
  roomsOnBooks: v.number(),
  adr: v.optional(v.number()),
  source: v.string(),
  dataImportId: v.optional(v.id("dataImports")),
})
.index("by_propertyId_forecastDate", ["propertyId", "forecastDate"])
.index("by_propertyId_snapshotDate", ["propertyId", "snapshotDate"])
// Pace curve query: given propertyId + forecastDate, get all snapshots ordered by snapshotDate
.index("by_property_forecast_snapshot", ["propertyId", "forecastDate", "snapshotDate"])
```

### `budgets`

```typescript
defineTable({
  propertyId: v.id("properties"),
  companyId: v.id("companies"),
  fiscalYear: v.number(),
  month: v.number(),                  // 1–12
  categoryId: v.optional(v.id("revenueCategories")), // null = rooms budget
  budgetOccupancy: v.optional(v.number()), // 0.0 to 1.0 — validated max 1.0 (ECH)
  budgetAdr: v.optional(v.number()),
  budgetAmount: v.optional(v.number()),
  isOriginal: v.boolean(),            // ECH: read-only once fiscal year locked
  lockedAt: v.optional(v.number()),
})
.index("by_propertyId_year", ["propertyId", "fiscalYear"])
.index("by_property_year_month_category", ["propertyId", "fiscalYear", "month", "categoryId"])
```

### `alerts`

```typescript
defineTable({
  propertyId: v.id("properties"),
  companyId: v.id("companies"),
  type: v.union(v.literal("variance"), v.literal("pickup_velocity"), v.literal("custom")),
  status: v.union(
    v.literal("active"),
    v.literal("dismissed"),
    v.literal("resolved"),
    v.literal("snoozed")
  ),
  triggeredAt: v.number(),
  dismissedAt: v.optional(v.number()),
  dismissedBy: v.optional(v.string()),
  resolvedAt: v.optional(v.number()),
  refireAfter: v.optional(v.number()), // ECH: re-fire after M days if condition persists
  payload: v.object({                  // signal, context, action text
    signal: v.string(),
    context: v.string(),
    action: v.string(),
  }),
  relatedDate: v.optional(v.string()),
  relatedDateEnd: v.optional(v.string()),
})
.index("by_propertyId_status", ["propertyId", "status"])
.index("by_companyId_status", ["companyId", "status"])
```

### `extractorProfiles`

```typescript
defineTable({
  propertyId: v.id("properties"),
  mappings: v.any(),                  // Record<sourceLabel, categoryId>
  confirmedAt: v.optional(v.number()),
})
.index("by_propertyId", ["propertyId"])
```

### `extractionResults`

Persisted server-side to enable verify flow resume (ECH: browser-close recovery).

```typescript
defineTable({
  importId: v.id("dataImports"),
  propertyId: v.id("properties"),
  status: v.union(
    v.literal("pending"),
    v.literal("ready_for_verify"),
    v.literal("verified"),
    v.literal("failed"),
    v.literal("timeout")
  ),
  extractedFields: v.any(),           // array of { field, value, confidence, label }
  proposedMappings: v.any(),          // for first-upload mapping screen
  expiresAt: v.number(),              // 24hr TTL for resume (ECH: session persistence)
  auditDate: v.optional(v.string()),
  reportType: v.optional(v.string()),
})
.index("by_importId", ["importId"])
.index("by_propertyId", ["propertyId"])
```

---

## 7. Frontend Architecture (TanStack Start)

### Route Structure

```
apps/web/src/routes/
├── __root.tsx                    # Root: ConvexBetterAuthProvider, global layout
├── index.tsx                     # Landing / sign-in redirect
│
├── _auth/                        # Unauthenticated layout
│   ├── __layout.tsx
│   ├── sign-in.tsx
│   └── sign-up.tsx
│
├── _app/                         # Authenticated layout (portfolio sidebar)
│   ├── __layout.tsx              # Sidebar + property context provider
│   │
│   ├── onboarding/
│   │   ├── index.tsx             # Wizard entry / resume
│   │   ├── step-1.tsx            # Account / Company
│   │   ├── step-2.tsx            # Property Details
│   │   ├── step-3.tsx            # Room Count & Categories
│   │   ├── step-4.tsx            # Competitor Setup
│   │   └── step-5.tsx            # First Upload (skippable)
│   │
│   ├── $propertyId/
│   │   ├── upload.tsx            # Night auditor: upload + status
│   │   ├── verify.$importId.tsx  # AI verify flow (reactive)
│   │   ├── dashboard.tsx         # Owner overview (P1.12)
│   │   │
│   │   ├── history/
│   │   │   ├── rooms.tsx         # P1.13
│   │   │   ├── non-rooms.tsx     # P1.14
│   │   │   ├── competition.tsx   # P1.15
│   │   │   └── payments.tsx      # P1.16
│   │   │
│   │   ├── forecast.tsx          # P1.17–P1.22
│   │   ├── budget.tsx            # P1.23–P1.24
│   │   ├── alerts.tsx            # P1.25–P1.26
│   │   └── settings.tsx          # Property settings, categories, extractor profile
│   │
│   └── manual-entry.$propertyId.$date.tsx  # P1.9 fallback
│
└── api/
    └── auth/$.ts                 # Better Auth HTTP handler (already scaffolded)
```

### Data Fetching Pattern

All Convex queries are consumed via `@convex-dev/react-query`, which exposes them as React Query subscriptions:

```typescript
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@my-better-t-app/backend/convex/_generated/api";

// In a route component:
const { data: dashboard } = useQuery(
  convexQuery(api.dashboard.getOwnerDashboard, { propertyId, year, month })
);
// This is a live subscription — updates in real-time when Convex data changes.
```

### Server Functions (SSR Auth)

TanStack Start `createServerFn` is used only where SSR needs auth context (e.g. initial token hydration in `__root.tsx`). Most data loading uses Convex queries directly.

```typescript
// __root.tsx — already scaffolded pattern:
const getAuth = createServerFn({ method: "GET" }).handler(async () => {
  return await getToken(); // from auth-server.ts
});
```

### Route Protection

Auth guard lives in the `_app/__layout.tsx` `beforeLoad`:

```typescript
beforeLoad: async ({ context }) => {
  if (!context.isAuthenticated) {
    throw redirect({ to: "/sign-in" });
  }
  // Auditor role guard: redirect away from non-upload routes
}
```

---

## 8. AI Ingestion Pipeline

### Pipeline Flow

```
1. Client requests generateUploadUrl (Convex mutation)
   → Returns: signed Convex storage upload URL
   → Checks: file size < 50MB, mime type allowed (ECH: strictly < 50_000_000 bytes)
   → Checks: no extraction in-flight for this property (ECH: concurrent upload lock)

2. Client uploads file directly to Convex storage
   → Returns: storageId

3. Client calls recordUpload mutation
   → Creates dataImports record (scanStatus: "pending")
   → Schedules internal.uploads.runMalwareScan via scheduler.runAfter(0, ...)

4. Malware Scan (internalAction)
   → ClamAV or AWS scan
   → On clean: marks scanStatus: "clean", schedules runExtraction
   → On infected/timeout/error: marks scan_failed → upload rejected (ECH: scan failure = block)
   → Client reactive query on dataImports detects status change in real time

5. Extraction (internalAction — calls Claude claude-sonnet-4-6)
   → Marks extractionStatus: "in_progress"
   → Parses file (pdf-parse / xlsx)
   → Calls Claude with structured output schema
   → Hard timeout: 30s (ECH: timeout state + manual entry offered)
   → On success: saves extractionResults document (status: "ready_for_verify")
   → On failure: saves extractionResults (status: "failed") with reason
   → On timeout: saves extractionResults (status: "timeout")

6. Verify Flow (client subscribes to extractionResults via reactive query)
   → Split-screen: file preview (left) + extracted fields (right)
   → Confidence: green ≥ 92% | yellow < 92% or first-seen | red = not found
   → Financial reconciliation check: sum(payments) vs sum(revenue) (ECH: even if all green)
   → Date guard: warn if future date or > 7yr past (ECH)
   → User confirms/corrects; all yellow+red must be resolved before submit
   → Browser-close safe: extractionResults persisted 24hrs for resume (ECH)

7. Confirm (mutation)
   → Writes auditRecord + all stats documents (atomic)
   → On duplicate date: requires overwrite_confirmed flag (ECH: explicit overwrite)
   → On overwrite: schedules forecast cache invalidation (ECH: stale cache guard)
   → Schedules: paceSnapshot archival, alert evaluation
   → Corrected fields fed back to extractor profile learning loop
   → Marks property.status = "active" if first verified submission
```

### Confidence Scoring

| Score | Display | Action Required |
|-------|---------|-----------------|
| ≥ 92% | 🟢 Green | Pre-confirmed, no action |
| < 92% or first-seen label | 🟡 Yellow | User must confirm or remap |
| Not found / extraction failed | 🔴 Red | User must enter manually |

### Category Mapper

The `extractorProfiles` document holds `mappings: Record<sourceLabel, categoryId>`. On each upload:
1. Known labels → auto-confirmed (green) via profile lookup
2. New labels → yellow, presented for mapping
3. Multiple candidates for same label → force yellow with disambiguation choices (ECH)
4. Case-insensitive + abbreviation normalization via the LLM prompt

### File Naming (P1.7)

```typescript
// nanoid(4) prevents filename collision (ECH)
// reportType defaults to "report" if AI cannot determine (ECH)
// auditDate is prompted from user if AI cannot determine before storage (ECH)
const filename = `${propertySlug}-${reportType ?? "report"}-${auditDate}-${nanoid(4)}.${ext}`;
// e.g.: riverport-night-audit-2026-03-03-x7k2.pdf
```

### Failure Modes

| Scenario | Behavior |
|----------|----------|
| Scan timeout / error | Reject upload: "Security scan failed — try again" (ECH) |
| Extraction timeout > 30s | Show timeout state; offer manual entry option (ECH) |
| Network drop > 60s client-side | Client timeout guard → error state with retry (ECH) |
| Full extraction failure | Error screen: file preview + failure reason + retry + manual entry |
| Partial extraction < 50% fields | Yellow/red all missing; user prompted before submit |
| Concurrent upload in-flight | Lock guard: "Extraction in progress, please wait" (ECH) |
| Verify flow browser-close | `extractionResults` persisted; resume via same `importId` (ECH) |
| Duplicate audit date on confirm | Warning with prior submission info; explicit `overwrite_confirmed` required |
| Overwrite confirmed | `forecast cache invalidation` + `rolling forecast recalc` triggered (ECH) |

---

## 8a. AI Extraction Specification

> **Previously absent — added in v1.1 to address adversarial finding #5.**

### Claude System Prompt Structure

```
You are a hotel PMS report parser. Extract structured financial data from the provided hotel audit report.

PROPERTY CONTEXT:
- Property name: {property.name}
- Total rooms: {property.totalRooms}
- Revenue categories: {categories[].name} (IDs: {categories[].id})
- Known label mappings: {JSON.stringify(extractorProfile.mappings)}
  (Format: { "source label from PMS": "categoryId" })

EXTRACTION INSTRUCTIONS:
1. Identify the audit date. Look for patterns: "Date:", "Night of:", "Report Date:", "For the Night of".
   If no date is found, set auditDate to null.
2. Identify the report type. Common values: "night-audit", "daily-report". Default to "report" if unclear.
3. Extract all numeric fields per the output schema below.
4. For each revenue line item:
   a. Check if its label (case-insensitive) matches a key in the known label mappings.
      If matched: set confidence to 1.0 and use the mapped categoryId.
   b. If not matched: propose the closest revenue category by semantic similarity.
      Set confidence < 0.92 to trigger user review.
   c. If no category fits: set proposedCategoryId to null and confidence to 0.
5. If a field is not present in the document: set value to null and confidence to 0.
6. Extract pace data: the forward booking table (rooms on books by future date).
   This is typically a table with columns: Date | Rooms On Books | ADR (or similar).
   Extract all rows up to 365 days forward.
7. If the document appears to be a scanned image (no extractable text),
   set extractionStatus to "image_pdf" and all field values to null.

OUTPUT: Respond ONLY with valid JSON matching the schema below. No prose.
```

### Output JSON Schema

```typescript
type ExtractionField<T> = {
  value: T | null;
  confidence: number;   // 0.0–1.0; >= 0.92 auto-confirmed (green), < 0.92 needs review (yellow), 0 = not found (red)
  sourceText: string;   // verbatim text from document that produced this extraction
};

type ExtractionResult = {
  auditDate: string | null;          // "YYYY-MM-DD"
  reportType: string | null;         // "night-audit" | "daily-report" | "report"
  extractionStatus: "success" | "partial" | "failed" | "image_pdf";
  fields: {
    roomsOccupied: ExtractionField<number>;
    adr: ExtractionField<number>;
    sameDayCancellations: ExtractionField<number>;
    noShows: ExtractionField<number>;
    compRooms: ExtractionField<number>;
    oooRooms: ExtractionField<number>;
  };
  paceSnapshot: Array<{
    forecastDate: string;            // "YYYY-MM-DD"
    roomsOnBooks: number;
    adr: number | null;
    confidence: number;
  }>;
  nonRoomRevenue: Array<{
    sourceLabel: string;             // raw label from document
    proposedCategoryId: string | null;
    amount: number;
    confidence: number;
  }>;
  payments: Array<{
    paymentType: string;             // normalized: "VISA", "AMEX", "Cash", etc.
    amount: number;
    confidence: number;
  }>;
  competition: Array<{
    competitorName: string;
    rate: number | null;
    availableRooms: number | null;
    dailyOccupancy: number | null;   // 0.0–1.0
    confidence: number;
  }>;
};
```

### Extractor Profile Injection

The property's `extractorProfile.mappings` (`Record<sourceLabel, categoryId>`) is serialized and embedded in the system prompt at extraction time. The LLM uses it to auto-confirm known labels at confidence 1.0. This eliminates re-review for recurring PMS vocabulary after the first confirmed upload.

On confirmation in the verify flow, any corrected or newly mapped label is written back to `extractorProfile.mappings` via `confirmVerify` mutation — closing the learning loop.

### Scanned Image Handling

If `pdf-parse` extracts fewer than 50 characters of text from a PDF:
1. Flag document as `image_pdf` — skip Claude call entirely (saves token cost)
2. Save `extractionResults` with `status: "failed"`, `extractedFields: []`
3. Frontend routes to full failure flow (P1.5): file preview + message "This appears to be a scanned image. Please enter data manually." + manual entry option

**No OCR is attempted in Phase 1.** OCR support (Tesseract or AWS Textract) is a Phase 2 enhancement.

### File Parsing by Type

| Format | Parser | Notes |
|---|---|---|
| PDF | `pdf-parse` (npm) | Text extraction only; image PDFs detected by char count < 50 |
| XLSX / XLS | `xlsx` (SheetJS) | Convert to CSV-like structure before Claude prompt |
| CSV | Native string | Passed directly to Claude with delimiter detection |

All parsing runs inside the Convex `runExtraction` action before the Claude call.

---

## 8b. Forecast Algorithm Specification

> **Previously absent — added in v1.1 to address adversarial finding #6.**

### Inputs

| Input | Source |
|---|---|
| Current OTB (rooms on books by date) | Latest `paceSnapshots` where `snapshotDate = today` |
| LY pace curve (rooms on books by advance window, LY) | `paceSnapshots` where `snapshotDate` = same calendar date, prior year |
| Budget occupancy + ADR | `budgets` table for current property/year/month |
| Property total rooms | `properties.totalRooms` |

### Algorithm — Demand-Weighted Revenue Projection (P1.18)

For each remaining date `d` in the current month:

**Step 1 — LY equivalent date**
```
d_ly = same calendar date, prior year
     // Leap year guard: if d_ly = Feb 29 and current year is not leap → use Feb 28 (ADR-004)
```

**Step 2 — LY remaining pickup at equivalent advance**
```
advance_days = d - today   // days until stay date
ly_otb_at_same_advance = paceSnapshot where forecastDate=d_ly AND snapshotDate=(d_ly - advance_days)
ly_otb_at_stay = paceSnapshot where forecastDate=d_ly AND snapshotDate=d_ly  // actual final rooms
ly_remaining_pickup = ly_otb_at_stay - ly_otb_at_same_advance
```

**Step 3 — TY pickup velocity ratio**
```
ty_pickup_trailing_7d = current_otb[d] - otb_7_days_ago[d]   // from paceSnapshot 7 days prior
ly_pickup_trailing_7d = ly_pace_curve[advance_days] - ly_pace_curve[advance_days + 7]

if (ly_pickup_trailing_7d === 0):
    velocity_ratio = 1.0   // flat assumption; display warning label per P1.18
else:
    velocity_ratio = ty_pickup_trailing_7d / ly_pickup_trailing_7d
    velocity_ratio = clamp(velocity_ratio, 0, 3.0)   // cap at 3× to prevent outlier explosion
```

**Step 4 — Projected rooms**
```
projected_rooms[d] = current_otb[d] + (ly_remaining_pickup × velocity_ratio)
projected_rooms[d] = clamp(projected_rooms[d], current_otb[d], property.totalRooms)
```

**Step 5 — Projected revenue per date**
```
rate = budgetAdr ?? current_otb_adr[d] ?? lyAdr[d]   // fallback chain
projected_revenue[d] = projected_rooms[d] × rate
```

**Step 6 — Month-end projection total (P1.18 display)**
```
forecast_total = sum(actuals[d].roomRevenue for d in past_dates this month)
              + sum(projected_revenue[d] for d in remaining_dates)
```

### Fallback: No LY Data Available

When `ly_pace_curve` is absent (new property, or property opened < 1 year ago):
- Projection = `current_otb[d] × budget_adr` (flat, no pickup adjustment)
- Display label: *"Forecast based on current bookings only — no prior year data available"*
- This matches PRD P1.18 acceptance criteria

### Pickup Velocity Alert Threshold (P1.22)

```
alert_condition = (ty_pickup_trailing_7d / ly_pickup_trailing_7d) < property.pickupVelocityThresholdPct / 100
                  AND ly_pickup_trailing_7d > 0   // ECH: skip if LY rate = 0
```

Alert resolves when `velocity_ratio >= threshold` for 2 consecutive evaluation days (ADR-007).

### LY vs TY Pace Overlay Color Logic (P1.21)

```
pace_gap_pct = (current_otb[d] - ly_otb_at_same_advance) / ly_otb_at_same_advance × 100

if pace_gap_pct >= 0:              color = GREEN
if pace_gap_pct >= -paceYellowThresholdPct AND < 0:  color = YELLOW
if pace_gap_pct < -paceRedThresholdPct:              color = RED
if ly_otb_at_same_advance is null: display = "—" (no color)
```

Thresholds sourced from `property.paceYellowThresholdPct` and `property.paceRedThresholdPct` (defaults: 10% each, configurable per ADR per PRD P1.21).

---

## 9. Security Architecture

### Tenant Isolation

Every Convex function resolves the caller's identity via Better Auth:

```typescript
// Standard pattern for all Convex functions:
export const getSomeData = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    const profile = await ctx.db.query("userProfiles")
      .withIndex("by_userId", q => q.eq("userId", identity.subject))
      .first();
    if (!profile) throw new ConvexError("No profile");

    // Auditor: verify they're scoped to this specific property
    if (profile.role === "auditor" && profile.propertyId !== args.propertyId) {
      throw new ConvexError("Access denied");
    }

    // Owner/GM: verify property belongs to their company
    const property = await ctx.db.get(args.propertyId);
    if (!property || property.companyId !== profile.companyId) {
      throw new ConvexError("Access denied");
    }

    // Safe to proceed
  }
});
```

No function accepts `companyId` as a client argument — it is always resolved from the authenticated session.

### Role-Based Access Control

| Role | Accessible Functions |
|------|---------------------|
| Owner | All functions for their company |
| GM | All functions for their assigned property |
| Auditor | `uploads.*`, `verify.*` only — all other functions throw "Access denied" |

### File Upload Security

1. **Mime type allowlist** — validated server-side in Convex mutation (client mime is untrusted)
2. **Size cap** — `fileSizeBytes < 50_000_000` validated before `generateUploadUrl`
3. **Malware scan** — blocking step before extraction proceeds; scan failure = rejection (ECH)
4. **Convex storage** — files isolated per property; access via generated signed URLs
5. **Storage existence check** — download path checks Convex storage before serving URL (ECH)
6. **No public file URLs** — all file access is through authenticated Convex functions

### Authentication Flow

```
Browser → Better Auth sign-in → JWT token
Token → passed to Convex via ConvexBetterAuthProvider (client)
Token → passed to Convex via createServerFn (SSR: __root.tsx getAuth)
Convex → ctx.auth.getUserIdentity() → validates token per-function
```

---

## 10. Infrastructure & Deployment

### Phase 1 Architecture

```
GitHub
  │
  ▼
GitHub Actions
  ├── bun lint / type-check / test
  └── Deploy
        ├── apps/web → Vercel (TanStack Start SSR)
        └── packages/backend → Convex Cloud (managed)
```

**Convex Cloud** handles:
- Serverless function hosting (queries, mutations, actions)
- Document database (globally replicated)
- File storage (with 50MB file limit)
- Cron job scheduling
- Real-time subscriptions
- Dashboard + logs

**Vercel** (or Netlify / Railway):
- TanStack Start SSR
- Edge-ready via Vite + Nitro adapter

### Environment Variables

```
# packages/backend/.env.local
CONVEX_DEPLOYMENT=...
SITE_URL=https://app.revparmax.com

# apps/web/.env.local
VITE_CONVEX_URL=https://....convex.cloud
VITE_SITE_URL=https://app.revparmax.com
```

### Monitoring

- **Convex Dashboard** — function logs, error rates, query performance
- **Sentry** — frontend error tracking + source maps
- **Axiom** — structured log ingestion from Convex action logs
- **Uptime alert** — Convex webhook or cron: alert if property has no verified submission for 28+ hours

### Data Retention

- Convex documents: retained per Convex plan limits; living snapshots retained indefinitely
- File storage (Convex): 7-year retention enforced via manual deletion cron at `creationTime + 7yr`
- Churned properties: 90-day retention cron job marks property inactive, then deletes documents

### Storage Scale — Corrected Estimate

> **Note:** The PRD §5 storage estimate of "~1,825 snapshot rows/property/year" is incorrect. The Living Snapshot stores 365 forward-looking rows **per property per day** (one snapshot of the full 365-day pace window). Correct scale:
>
> - **133,225 rows/property/year** (365 rows/day × 365 days)
> - At 50 properties (realistic Phase 1 ceiling): ~6.7M rows/year
> - At 200 properties: ~26.6M rows/year
> - At 500 properties: ~66.6M rows/year
>
> Convex handles this volume without issue at Phase 1 scale (≤ 50 properties). Indexes on `(propertyId, forecastDate)` and `(propertyId, snapshotDate)` ensure forecast queries remain within the 500ms SLA. No archival strategy is needed for Phase 1. Revisit at 200+ properties.

### Malware Scan Vendor — Resolved

**Decision:** AWS Malware Protection for S3 (via Amazon GuardDuty).

**Rationale:** Convex Storage uses S3-compatible object storage under the hood; files can be scanned via S3 event notifications + GuardDuty Malware Protection without adding a sidecar process. Managed service with predictable latency (< 5s for files ≤ 5MB), no infrastructure to operate, and straightforward failure handling. ClamAV requires a self-managed sidecar — eliminated.

**Integration:** After `recordUpload` stores the `storageId`, the `runMalwareScan` action retrieves the file URL, triggers a GuardDuty scan job, and polls for result (max 15s timeout). On `CLEAN` → proceed to extraction. On `INFECTED` / `ERROR` / `TIMEOUT` → reject, per ECH guard.

### Phase 1 AI Compute Cost Estimate

| Unit | Estimate |
|---|---|
| Tokens per nightly upload (input + output) | ~3,000–5,000 tokens |
| Cost per upload (Claude claude-sonnet-4-6) | ~$0.02–$0.05 |
| 50 properties × 30 nights/month | ~$30–$75/month |
| 200 properties | ~$120–$300/month |

This is a known, bounded cost. At a per-property subscription price of $X/month, AI extraction costs are < 5% of revenue at any realistic Phase 1 price point. No per-property compute budget controls are required in Phase 1.

---

## 11. Key Architectural Decision Records (ADRs)

### ADR-011: PRD Onboarding Time Target — Resolved

**Decision:** The canonical onboarding time target is **< 30 minutes** (measurable success metric). The "< 20 minutes" figure in PRD §3 Goal 4 is an aspirational UX goal, not a testable acceptance criterion.

**Rationale:** PRD §3 Goals state "< 20 minutes" while the Success Metrics table states "< 30 minutes." These cannot both be the target. The metric table is the authoritative source for measurement. The 20-minute aspiration should be noted in UX guidance but not used as a pass/fail criterion.

**Action required:** Update PRD §3 Goal 4 to read "< 30 minutes (< 20 minutes aspirational)" for consistency with the metric table.

---

### ADR-001: Convex as Single Backend — No Separate API Server

**Decision:** All backend logic runs as Convex queries, mutations, and actions. No Hono/Express API server.

**Rationale:** Convex provides the database, real-time subscriptions, job scheduling, and file storage in one managed platform. Eliminates the operational overhead of managing PostgreSQL, Redis, BullMQ, and a separate API server at Phase 1 scale. TanStack Start server functions (`createServerFn`) handle the few cases requiring SSR server-side logic (auth token hydration).

**Consequence:** All business logic must be expressible as Convex function types. External API calls (LLM, malware scan) use `action` type. Uniqueness constraints are enforced in mutations via read-then-write (Convex's transaction isolation makes this safe).

---

### ADR-002: Uniqueness Enforced in Mutations (Not DB Constraints)

**Decision:** `(propertyId, auditDate)` uniqueness is enforced in the `createAuditRecord` mutation with a preceding query inside the same transaction.

**Rationale:** Convex does not support DB-level unique constraints. Convex's serializable transaction isolation ensures the read-then-write is safe. The ECH fix (property-level, not company-level) is applied here.

---

### ADR-003: Derived Metrics Computed, Never Stored

**Decision:** `roomRevenue`, `revpar`, `occupancy` are computed at query time.

**Rationale:** Prevents data inconsistency when source fields are corrected post-verification. Single source of truth in `roomStatistics.adr` × `roomStatistics.roomsOccupied`.

---

### ADR-004: Timezone-Aware Date Logic via `property.timezone`

**Decision:** All "today" date comparisons use `DateTime.fromMillis(Date.now(), { zone: property.timezone }).toISODate()`.

**Rationale:** ECH finding: server's UTC date may differ from property's local date, causing false missing-data warnings and incorrect status badges.

---

### ADR-005: Soft Deletes for Categories with Historical Data

**Decision:** Revenue categories with any associated `nonRoomRevenue` documents cannot be hard-deleted. Deletion sets `archivedAt`; archived categories are hidden from new entry but retained in history queries.

**Rationale:** ECH finding: hard-deleting a mapped category orphans historical revenue records and breaks the extractor profile for future uploads.

---

### ADR-006: Extraction Results Persisted for 24-Hour Resume

**Decision:** `extractionResults` documents are persisted in Convex with a 24-hour TTL, keyed by `importId`.

**Rationale:** ECH finding: closing the browser mid-verify loses extraction state, forcing re-upload and consuming extraction quota again. The verify flow loads by `importId`; returning users resume where they left off.

---

### ADR-007: Alert Re-Fire Logic Defined

**Decision:** Dismissed alerts have `refireAfter = dismissedAt + 7 days`. The nightly cron re-activates them if the underlying condition still holds. Pickup velocity alerts resolve when `pickupRate >= 50% of LY for 2 consecutive days`.

**Rationale:** ECH finding: no re-fire condition means persistent underperformance is silently suppressed after first dismissal. ECH finding: no resolution condition means pickup alerts never clear.

---

### ADR-008: Budget Interactive Controls Are Session-Only

**Decision:** Budget Occupancy / ADR adjustments in the Forecast view are held in component state and never written to Convex. Only an explicit "Save as budget" button triggers a mutation.

**Rationale:** PRD P1.20 explicit requirement. `beforeunload` warning added to prevent owner believing changes were saved (ECH).

---

### ADR-009: Fiscal Year Budget Lock

**Decision:** When a fiscal year is locked (explicit action or year begins), all budget rows for that year have `isOriginal: true` and `lockedAt` set. The lock is detected before allowing writes. Subsequent edits create Rolling Forecast records, not modifications to original.

**Rationale:** ECH finding: changing fiscal year start mid-year could destroy the read-only original budget baseline.

---

### ADR-010: `@convex-dev/react-query` for All Data Fetching

**Decision:** All Convex queries are consumed via `convexQuery()` from `@convex-dev/react-query`, not raw `useQuery` from the Convex React library.

**Rationale:** Consistent with the existing scaffold. React Query's cache + Convex's real-time subscriptions gives the verify flow and upload status screen live updates without polling, replacing the need for explicit WebSocket subscription management.

---

## 12. Edge Case Guards — Implementation Map

| ECH Location | Guard | Layer |
|---|---|---|
| PRD:99 — unique constraint company_id+date | `(propertyId, auditDate)` uniqueness in mutation transaction | Convex mutation |
| PRD:144 — room count ≤ 0 | `totalRooms >= 1` validated in `createProperty` mutation | Mutation arg validation |
| PRD:148 — whitespace-only property name | `name.trim().length > 0` validated in mutation | Mutation + frontend |
| PRD:149 — property permanently incomplete | `status: "pending_first_upload"`; dashboard shows prompt | App logic |
| PRD:163 — first upload fails, empty mapping screen | Skip mapping; route to P1.5 failure flow if `extractedLabels.length === 0` | Verify flow logic |
| PRD:165 — duplicate category name | Case-insensitive check in `createCategory` mutation before write | Mutation |
| PRD:165 — abandon mapping mid-session | `beforeunload` warning; draft mappings autosaved to `extractionResults` | Frontend |
| PRD:177 — 50MB boundary ambiguity | `fileSizeBytes < 50_000_000` (strictly less than) | Mutation validation |
| PRD:178 — concurrent upload during extraction | Lock check: query `dataImports` for `in_progress` before `generateUploadUrl` | Mutation |
| PRD:179 — no prior submissions null display | Null-safe: show "No prior submissions" if `lastSubmission` is null | Frontend |
| PRD:193 — future audit date | Warn if `manualDate > today (property tz)` | Frontend + mutation |
| PRD:193 — audit date > 7yr in past | Warn if `manualDate < today - 7yr` | Frontend + mutation |
| PRD:195 — extraction timeout | Worker hard-caps at 30s; saves `status: "timeout"`; client shows manual entry option | Action + frontend |
| PRD:219 — payments don't reconcile | Reconciliation check in `confirmVerify` even if all fields green | Mutation |
| PRD:220 — red field not applicable (no competitors) | Allow skip with N/A reason if field not required for this property config | Verify flow |
| PRD:214 — overwrite corrupts forecast cache | `scheduler.runAfter` invalidates forecast cache on overwrite | Mutation |
| PRD:222 — network drop mid-extraction | 60s client-side timeout → error state with retry | Frontend |
| PRD:223 — browser close during verify | `extractionResults` persisted 24hr; resume on return via `importId` | Convex + frontend |
| PRD:235 — two categories → same mapping | Force yellow + disambiguation choices when `candidates.length > 1` | AI mapper |
| PRD:237 — mapped category deleted | Block hard delete if `nonRoomRevenue` docs reference category | `archiveCategory` mutation |
| PRD:244 — filename collision | `nanoid(4)` suffix on all stored filenames | File naming util |
| PRD:248 — AI can't determine date AND type | Prompt date separately; default type to `"report"` | Extraction + frontend |
| PRD:261 — nested ZIP in backfill | Skip + flag at depth > 1 in backfill action | Backfill action |
| PRD:262 — duplicate audit dates in batch | Flag all conflicts; user resolves before finalizing | Backfill action |
| PRD:260 — all batch files fail | Full failure state; abort + show guidance | Backfill action |
| PRD:265 — concurrent backfill jobs | Query for in-progress backfill job before starting new one | Mutation lock |
| PRD:295 — manual entry > 365 days future | Reject `entryDate > today + 365` | Mutation validation |
| PRD:296 — ADR with rooms_occupied = 0 | Warn: "ADR has no effect when Rooms Occupied is 0" | Frontend |
| PRD:311 — timezone mismatch on status | `toLocalDate(now, property.timezone)` for all status calculations | Queries |
| PRD:323 — large property selector | Searchable dropdown when `properties.length > 20` | Frontend |
| PRD:341 — partial LY data mid-month | Partial LY line with coverage indicator in chart | Query + chart |
| PRD:362 — LY = 0, YoY division by zero | Display `N/A` instead of calculating | Query layer |
| PRD:376 — negative non-room revenue | Allowed; render with distinct color in donut/table | Chart logic |
| PRD:388 — last competitor deleted | Empty state with "Add competitor" prompt | Frontend |
| PRD:389 — no competitor ≥ 7 days data | Explicit empty state message; distinguish from broken chart | Frontend |
| PRD:420 — all forecast lines unavailable | Empty state: "Add budget and submit data to see forecast" | Frontend |
| PRD:423 — last day of month | "Month ends today — no future dates to forecast" message | Frontend |
| PRD:434 — OTB = 0 and no LY pace | Show projection as unavailable, not $0 | Forecast query |
| PRD:445 — Feb 29 leap year PACE NET | Map Feb 29 → Feb 28 for TY comparison, with note | Forecast query |
| PRD:458 — unsaved budget controls on close | `beforeunload` warning | Frontend |
| PRD:459 — budget occupancy > 100% | `budgetOccupancy <= 1.0` validated in mutation + frontend clamp | Mutation + frontend |
| PRD:474 — yellow threshold = red threshold | Validate `yellowLow > redThreshold` in `updateSettings` mutation | Mutation |
| PRD:483 — LY pickup rate = 0, division by zero | Skip alert if `lyPickupRate === 0`; show "No LY baseline" | Alert cron |
| PRD:483 — pickup alert never clears | `resolvedWhen`: `pickupRate >= 50% of LY` for 2 consecutive days | Alert cron |
| PRD:501 — LY distribution, no LY data | Disable LY distribution option with tooltip | Frontend |
| PRD:503 — CSV budget duplicate rows | Reject with line numbers or last-row-wins with warning | Budget import action |
| PRD:511 — fiscal year start changed mid-year | Warn + re-confirm original budget lock in `updateSettings` | Settings mutation |
| PRD:513 — backdated correction, stale forecast | `scheduler.runAfter` triggers rolling forecast recalc | Audit record mutation |
| PRD:528 — data gaps in N-day variance window | Gaps reset N (conservative approach) | Alert cron |
| PRD:530 — dismissed alert, condition persists | `refireAfter = dismissedAt + 7 days`; daily cron re-activates | Alert cron |
| PRD:529 — variance threshold X = 0% | `varianceThresholdPct >= 1` validated in settings mutation | Settings mutation |
| PRD:548 — alert links to past forecast date | Redirect past dates to historical view | Frontend routing |
| PRD:563 — file in DB but deleted from storage | Check Convex storage existence before returning URL | Files query |
| PRD:643 — malware scan fails / times out | Reject upload; never proceed to extraction | Scan action |
| PRD:644 — auditor needs re-scoping | `reassignAuditor` mutation (GM-only): updates `userProfiles.propertyId` | Settings mutation |

---

*v1.0 — Generated by BMad Master from PRD v1.1 and ECH review (55 findings). Stack: TanStack Start + Convex + Better Auth + Bun + Turborepo + Ultracite.*

*v1.1 — Patched by BMad Master from adversarial review (15 findings). Added: §8a AI Extraction Specification, §8b Forecast Algorithm, corrected paceSnapshot storage scale, resolved malware scan vendor (AWS), added compute cost estimate, added ADR-011 (onboarding time target). Convex backend retained — scale validates choice for Phase 1.*
