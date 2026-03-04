# Upload Pipeline — Session Handoff (Steps 6 + 7 built)

## What was built (Steps 6 + 7)

### Backend
- `schema/extraction.ts` — added `payments` + `paceSnapshot` to `extractionResults` table
- `uploads/internalMutations.ts` — `markExtractionResult` stores payments + paceSnapshot
- `uploads/internalActions.ts` — `runExtraction` passes payments + paceSnapshot; `EMPTY_RESULT` updated
- `uploads/queries.ts` — added `getVerifyData` query (dataImport, extractionResult, property, categories, fileUrl)
- `uploads/mutations.ts` — added `confirmVerify` (atomic write: auditRecord+roomStats+nonRoomRevenue+payments+paceSnapshots)

### Frontend
- `routes/upload/verify/$importId.tsx` — NEW full verify UI (split-screen, confidence coloring, date guard, reconciliation, submit)
- `routes/upload/$propertyId.tsx` — "Review extracted data" now links to verify route
- `routeTree.gen.ts` — registered `/upload/verify/$importId`

### confirmVerify guards
- IN-001 (category validation), IN-012 (patch not replace mappings), IN-017 (date format)
- Duplicate date → DUPLICATE_AUDIT_DATE error → overwrite confirmation checkbox
- Marks property.status = "active" on first verified submission

## Deferred
- Revenue categories seed (empty → proposedCategoryId always null)
- Real GuardDuty scan (stub remains)
- Crons: scan timeout guard (ADR-012), 24hr extractionResults cleanup (IN-004)
- Forecast cache invalidation on overwrite (TODO in confirmVerify)

---

# Original Plan: Data Upload Pipeline — Upload + Extraction MVP

## Context
The onboarding wizard is live and users can create companies + properties. The next step is letting users upload PMS export files (PDF/XLSX/CSV) so RevParMax can extract financial data via Claude. This session implements Steps 1–5 of the pipeline (generateUploadUrl → upload → recordUpload → stub scan → extraction), leaving the verify/confirm UI for the next session.

---

## Files to Create / Modify

### Backend — `packages/backend/convex/uploads/` (new directory)

#### 1. `mutations.ts`
- `generateUploadUrl` (public mutation)
  - Auth: `requireUserProfile`; role must be `owner` or `gm`
  - Args: `{ propertyId, fileSizeBytes, mimeType }`
  - Validates mimeType ∈ PDF/CSV/XLS/XLSX
  - Validates `fileSizeBytes < 50_000_000`
  - Checks no in-flight extraction on this property via `by_extractionStatus` index (IN-016)
  - Returns `{ uploadUrl }` from `ctx.storage.generateUploadUrl()`

- `recordUpload` (public mutation)
  - Args: `{ propertyId, storageId, originalFilename, fileSizeBytes, mimeType }`
  - Auth: `requireUserProfile`; role owner/gm; verify property belongs to user's company
  - Server-side size verify via `ctx.storage.getMetadata(storageId)` (IN-020)
  - Generate `storedFilename`: `${property.slug}-upload-${Date.now()}-${nanoid(4)}.${ext}`
  - Insert `dataImports`: `scanStatus: "pending"`, `extractionStatus: "pending"`
  - Schedule `internal.uploads.internalActions.runMalwareScan` via `ctx.scheduler.runAfter(0, ...)`
  - Returns `importId`

#### 2. `queries.ts`
- `getImport` — by importId, auth-guarded to user's company; returns dataImports doc + matching extractionResults doc
- `listImportsForProperty` — last 20 imports for a propertyId, auth-guarded

#### 3. `internalMutations.ts`
- `markScanResult({ importId, result: "clean" | "infected" | "scan_failed" })`
  - If clean: update scanStatus + schedule `runExtraction`
  - If infected/scan_failed: delete file from storage, patch `storageId: undefined` (IN-006)

- `markExtractionResult({ importId, status, result? })`
  - Update `dataImports.extractionStatus` + `extractedAt`
  - Insert `extractionResults` doc (status: ready_for_verify / failed / timeout, expiresAt: +24hr)

#### 4. `internalActions.ts` (with `"use node"` at top)
- `runMalwareScan` — stub: immediately calls `markScanResult("clean")`
  - Comment: `// TODO: replace stub with real GuardDuty submission (ADR-012)`

- `runExtraction`
  - Fetch blob: `ctx.storage.get(storageId)`
  - Parse by mimeType: pdf-parse (PDF), xlsx/SheetJS (XLSX/XLS), text (CSV)
  - Image PDF guard: if extracted chars < 50 → mark failed with "image_pdf" reason
  - Load property + extractorProfile + revenueCategories (ctx.runQuery)
  - IN-011: if mappings token estimate > 150k, truncate to 200 most-recent entries
  - Build system prompt from spec (8a-ai-extraction-specification.md)
  - Call `claude-sonnet-4-6` with structured output
  - 30s hard timeout via Promise.race
  - 3 retries with 2s/4s/8s backoff on 429/503
  - Call `markExtractionResult`

### Backend — `packages/backend/package.json`
Add dependencies:
- `@anthropic-ai/sdk: "^0.36.0"`
- `pdf-parse: "^1.1.1"`
- `xlsx: "^0.18.5"`
- `nanoid: "^3.3.11"`
Add devDependency: `@types/pdf-parse`

### Frontend — `apps/web/src/routes/dashboard.tsx`
- Add `useQuery(api.properties.queries.listMyProperties)`
- Replace placeholder text with property card list
- Each card: name, status badge, "Upload Report" button → `/upload/$propertyId`

### Frontend — `apps/web/src/routes/upload/$propertyId.tsx` (new)
Three local states:
1. **`idle`** — drag-drop zone, accept `.pdf,.xlsx,.xls,.csv`, client-side validation
2. **`uploading`** — calls `generateUploadUrl` → PUT to Convex storage → `recordUpload`
3. **`processing`** — `useQuery(api.uploads.queries.getImport)` reactive status:
   - pending/scanning → "Scanning…"
   - extracting → "Extracting with AI…"
   - completed → "Done — results ready" (link to verify route, placeholder for now)
   - errors (infected, scan_failed, failed, timeout) → error state + retry

---

## Key Design Decisions
- **Malware scan stub**: `runMalwareScan` immediately marks clean; GuardDuty plugs in later
- **Empty revenue categories**: Claude proceeds with empty array; `proposedCategoryId: null` for all revenue lines; mapping deferred to verify flow
- **`"use node"`**: Required in internalActions.ts for pdf-parse, xlsx, Anthropic SDK
- **nanoid**: Already in lockfile; add explicit dep to backend package.json

---

## Verification
1. `cd packages/backend && bun run dev:setup` — Convex deploys without errors
2. Sign in → dashboard → see property card with "Upload Report"
3. Upload test PDF at `/upload/$propertyId` → watch scan→extract states
4. Check Convex dashboard: `dataImports` + `extractionResults` tables have records
5. Validate extraction JSON matches schema in `8a-ai-extraction-specification.md`
