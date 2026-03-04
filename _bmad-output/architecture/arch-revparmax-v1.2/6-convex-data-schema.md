# 6. Convex Data Schema

Convex uses a document model. Tables have `_id: Id<"tableName">` and `_creationTime` automatically. All relationships are stored as `Id<"tableName">` references. Indexes are defined per table.

## `companies`

```typescript
defineTable({
  name: v.string(),                    // validated: trim().length > 0
})
.index("by_name", ["name"])
```

## `userProfiles`

Bridges Better Auth users (managed by the `betterAuth` component) to RevParMax companies and properties.

> **ADR-014 (v1.2):** `companyId` is now optional so a placeholder profile can be created atomically at sign-up via the `onUserCreate` hook in `auth.ts`, before the onboarding wizard assigns a company. `pending_onboarding` role is reserved for this state. All Convex functions must reject `pending_onboarding` profiles with `"Onboarding incomplete"` before proceeding.

```typescript
defineTable({
  userId: v.string(),                  // Better Auth user ID
  companyId: v.optional(v.id("companies")),  // set during onboarding wizard (ADR-014)
  propertyId: v.optional(v.id("properties")), // required for auditor role
  role: v.union(
    v.literal("owner"),
    v.literal("gm"),
    v.literal("auditor"),
    v.literal("pending_onboarding")    // set at sign-up; replaced on onboarding completion (ADR-014)
  ),
})
.index("by_userId", ["userId"])
.index("by_companyId", ["companyId"])
```

## `properties`

> **ADR-013 (v1.2):** Slug uniqueness is scoped to `(companyId, slug)`. Two different companies may independently use the slug `"riverport"` without collision. The uniqueness check in `createProperty` mutation must use `.eq('companyId', ...).eq('slug', ...)`. The old global `by_slug` index is replaced with `by_companyId_slug`.

```typescript
defineTable({
  companyId: v.id("companies"),
  name: v.string(),                    // validated: trim().length > 0
  slug: v.string(),                    // derived from trimmed name; unique within company (ADR-013)
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
.index("by_companyId_slug", ["companyId", "slug"])  // ADR-013: slug uniqueness scoped to company
```

## `dataImports`

> **ADR-012 (v1.2):** `scanJobId` field added to track the GuardDuty scan submission. `extractionId` is explicitly defined as the Convex scheduler job ID returned by `ctx.scheduler.runAfter` (IN-027), enabling cancellation and hang debugging.

```typescript
defineTable({
  propertyId: v.id("properties"),
  companyId: v.id("companies"),
  originalFilename: v.string(),
  storedFilename: v.string(),         // slug-type-date-nanoid4 format (ECH: collision suffix)
  storageId: v.optional(v.id("_storage")), // Convex storage ID
  fileSizeBytes: v.number(),          // validated: < 50_000_000 (ECH: strictly less than)
                                      // Note: server MUST verify against ctx.storage.getMetadata() (IN-020)
  mimeType: v.string(),
  scanStatus: v.union(
    v.literal("pending"),
    v.literal("clean"),
    v.literal("infected"),
    v.literal("scan_failed")          // ECH: scan_failed → rejected, never proceeds
  ),
  scanJobId: v.optional(v.string()),  // GuardDuty scan job ID; used to correlate webhook result (ADR-012)
  extractionStatus: v.union(
    v.literal("pending"),
    v.literal("in_progress"),
    v.literal("completed"),
    v.literal("failed"),
    v.literal("timeout")
  ),
  extractionId: v.optional(v.string()), // Convex scheduler job ID from ctx.scheduler.runAfter (IN-027)
  extractedAt: v.optional(v.number()),
  uploadedBy: v.string(),             // Better Auth user ID
})
.index("by_propertyId", ["propertyId"])
.index("by_extractionStatus", ["propertyId", "extractionStatus"])
.index("by_scanStatus_creationTime", ["scanStatus", "_creationTime"]) // ADR-012: timeout guard query
```

## `auditRecords`

```typescript
defineTable({
  propertyId: v.id("properties"),
  companyId: v.id("companies"),
  auditDate: v.string(),              // "YYYY-MM-DD" in property's local timezone
                                      // validated by ISO-8601 regex at mutation boundary (IN-017)
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

## `roomStatistics`

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

## `revenueParentCategories`

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

## `revenueCategories`

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

## `nonRoomRevenue`

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

## `paymentTypes`

```typescript
defineTable({
  propertyId: v.optional(v.id("properties")), // null = global default
  name: v.string(),
  isDefault: v.boolean(),
  archivedAt: v.optional(v.number()),
})
.index("by_propertyId", ["propertyId"])
```

## `paymentRecords`

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

## `competitors`

```typescript
defineTable({
  propertyId: v.id("properties"),
  name: v.string(),
  totalRooms: v.optional(v.number()),
  archivedAt: v.optional(v.number()),
})
.index("by_propertyId", ["propertyId"])
```

## `competitionData`

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

## `paceSnapshots` (The Living Snapshot)

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

## `budgets`

```typescript
defineTable({
  propertyId: v.id("properties"),
  companyId: v.id("companies"),
  fiscalYear: v.number(),
  month: v.number(),                  // 1–12; validated: month < 1 || month > 12 → throw (IN-013)
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

## `alerts`

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
  lastFiredAt: v.optional(v.number()), // IN-018: tracks last re-fire to enforce 7-day dampening
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

## `extractorProfiles`

```typescript
defineTable({
  propertyId: v.id("properties"),
  mappings: v.any(),                  // Record<sourceLabel, categoryId>
                                      // Each value MUST be validated as a valid Id<"revenueCategories"> (IN-001)
  confirmedAt: v.optional(v.number()),
})
.index("by_propertyId", ["propertyId"])
```

## `extractionResults`

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
.index("by_expiresAt", ["expiresAt"]) // IN-004: cleanup cron uses this index
```

---
