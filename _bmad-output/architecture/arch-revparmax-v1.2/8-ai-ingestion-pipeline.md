# 8. AI Ingestion Pipeline

## Pipeline Flow

```
1. Client requests generateUploadUrl (Convex mutation)
   → Returns: signed Convex storage upload URL
   → Checks: file size < 50MB, mime type allowed (ECH: strictly < 50_000_000 bytes)
   → Checks: no extraction in-flight for this property
   → Lock check + generateUploadUrl in SINGLE mutation to eliminate race window (IN-016)

2. Client uploads file directly to Convex storage
   → Returns: storageId

3. Client calls recordUpload mutation
   → Creates dataImports record (scanStatus: "pending")
   → Schedules internal.uploads.runMalwareScan via scheduler.runAfter(0, ...)

4. Malware Scan (internalAction + internalHttpAction webhook) — ADR-012
   → runMalwareScan action retrieves file URL, submits to GuardDuty Malware Protection
   → Stores returned scanJobId on dataImports record
   → GuardDuty delivers finding asynchronously via SNS → EventBridge →
       POST /api/malware-scan-result (internalHttpAction registered in http.ts)
   → Webhook handler calls internalMutation to update scanStatus:
       On CLEAN   → marks scanStatus: "clean"; schedules runExtraction
       On INFECTED → marks scanStatus: "infected"; upload rejected
       On ERROR   → marks scanStatus: "scan_failed"; upload rejected
   → 5-minute cron: any dataImports still scanStatus:"pending" after 15min → "scan_failed" (ADR-012)
   → On scan_failed: delete file from Convex storage; set storageId = undefined (IN-006)
   → Client reactive query on dataImports detects status change in real time

5. Extraction (internalAction — calls Claude claude-sonnet-4-6)
   → Marks extractionStatus: "in_progress"
   → Parses file (pdf-parse / xlsx)
   → Calls Claude with structured output schema
   → Hard timeout: Promise.race([runClaude(), sleep(30_000).then(() => { throw new Error('timeout') })]) (IN-003)
   → On success: saves extractionResults document (status: "ready_for_verify")
   → On failure: saves extractionResults (status: "failed") with reason
   → On timeout: saves extractionResults (status: "timeout")
   → Retries: 3 attempts with 2s/4s/8s exponential backoff on Claude 429/503 before marking failed (IN-028)

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
   → Corrected fields fed back to extractor profile via patch (not replace) to prevent concurrent overwrite (IN-012)
   → Marks property.status = "active" if first verified submission
```

## Confidence Scoring

| Score | Display | Action Required |
|-------|---------|-----------------|
| ≥ 92% | 🟢 Green | Pre-confirmed, no action |
| < 92% or first-seen label | 🟡 Yellow | User must confirm or remap |
| Not found / extraction failed | 🔴 Red | User must enter manually |

## Category Mapper

The `extractorProfiles` document holds `mappings: Record<sourceLabel, categoryId>`. On each upload:
1. Known labels → auto-confirmed (green) via profile lookup
2. New labels → yellow, presented for mapping
3. Multiple candidates for same label → force yellow with disambiguation choices (ECH)
4. Case-insensitive + abbreviation normalization via the LLM prompt

## File Naming (P1.7)

```typescript
// nanoid(4) prevents filename collision (ECH)
// reportType defaults to "report" if AI cannot determine (ECH)
// auditDate is prompted from user if AI cannot determine before storage (ECH)
const filename = `${propertySlug}-${reportType ?? "report"}-${auditDate}-${nanoid(4)}.${ext}`;
// e.g.: riverport-night-audit-2026-03-03-x7k2.pdf
```

## Failure Modes

| Scenario | Behavior |
|----------|----------|
| Scan timeout (> 15min) | Cron marks scan_failed; delete stored file (ADR-012 / IN-006) |
| Scan infected / error | Webhook marks scan_failed; delete stored file (ADR-012 / IN-006) |
| Extraction timeout > 30s | Show timeout state; offer manual entry option (ECH) |
| Network drop > 60s client-side | Client timeout guard → error state with retry (ECH) |
| Full extraction failure | Error screen: file preview + failure reason + retry + manual entry |
| Partial extraction < 50% fields | Yellow/red all missing; user prompted before submit |
| Concurrent upload in-flight | Lock guard: "Extraction in progress, please wait" (IN-016) |
| Verify flow browser-close | `extractionResults` persisted; resume via same `importId` (ECH) |
| Duplicate audit date on confirm | Warning with prior submission info; explicit `overwrite_confirmed` required |
| Overwrite confirmed | `forecast cache invalidation` + `rolling forecast recalc` triggered (ECH) |

---
