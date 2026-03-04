# 12. Edge Case Guards — Implementation Notes

## 12a. Legacy ECH Guards (from PRD ECH review — v1.0/v1.1)

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
| PRD:178 — concurrent upload during extraction | Lock check + generateUploadUrl in single mutation (IN-016) | Mutation |
| PRD:179 — no prior submissions null display | Null-safe: show "No prior submissions" if `lastSubmission` is null | Frontend |
| PRD:193 — future audit date | Warn if `manualDate > today (property tz)` | Frontend + mutation |
| PRD:193 — audit date > 7yr in past | Warn if `manualDate < today - 7yr` | Frontend + mutation |
| PRD:195 — extraction timeout | Worker hard-caps at 30s via Promise.race (IN-003); client shows manual entry option | Action + frontend |
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

## 12b. v1.2 Implementation Notes (from ECH arch review — 28 items)

> These are not architectural decisions. They are confirmed implementation requirements that must be addressed at the coding layer. Each note includes the guard snippet from the ECH review.

| ID | Location | Trigger Condition | Guard | Layer |
|---|---|---|---|---|
| IN-001 | §8a extractorProfile.mappings | Malformed mapping value from verify bug injected into Claude system prompt | Validate each mapping value: `if (typeof v !== 'string' \|\| !isId(v)) throw ConvexError('Bad mapping')` before writing to profile | `confirmVerify` mutation |
| IN-002 | §9 auditor guard | Auditor userProfile exists but `propertyId` is undefined due to registration bug | `if (profile.role === 'auditor' && !profile.propertyId) throw new ConvexError('Auditor account not configured')` | All Convex functions |
| IN-003 | §8 pipeline step 5 | App-level 30s timeout not implemented as `Promise.race`; Convex action runs to 10-minute hard limit | `await Promise.race([runClaude(), sleep(30_000).then(() => { throw new Error('timeout') })])` | `runExtraction` action |
| IN-004 | §5 crons | `extractionResults` with 24hr `expiresAt` TTL have no cleanup cron | `crons.daily('cleanup-expired-extractions', { hourUTC: 3 }, internal.ingestion.deleteExpiredResults)` | `crons.ts` |
| IN-005 | §5 crons | Client uploads file then crashes before calling `recordUpload`; orphaned storage objects accumulate | `crons.hourly('cleanup-orphaned-storage')` deletes `storageId`s absent from any `dataImports` record after 1hr | `crons.ts` |
| IN-006 | §8 pipeline step 4 | File flagged infected or `scan_failed`; rejected upload remains in Convex storage indefinitely | On scan reject: `await ctx.storage.delete(import.storageId); set dataImports.storageId = undefined` | `markScanResult` mutation |
| IN-007 | §8b Step 2 | Specific past `paceSnapshot` for `(d_ly, d_ly - advance_days)` missing; not total LY absence | `if (!ly_otb_at_same_advance)` skip date's pickup calc; use flat OTB × `budget_adr` fallback for that date only | Forecast query |
| IN-008 | §8b Step 3 | `paceSnapshot` from exactly 7 days ago missing for a `forecastDate` | Search nearest snapshot within ±3 days; if none found, `velocity_ratio = 1.0` with `'sparse data'` label | Forecast query |
| IN-009 | §8b Step 5 | `budgetAdr`, `current_otb_adr`, and `lyAdr` all null; rate fallback chain fully exhausted | `if (!rate) { projected_revenue[d] = null; mark date as 'rate unavailable'; skip multiplication }` | Forecast query |
| IN-010 | §8a File Parsing | XLSX file has multiple sheets; SheetJS reads only first sheet by default | Iterate `workbook.SheetNames`; select sheet with highest numeric cell count or concatenate all sheets | `runFileParse` action |
| IN-011 | §8a Extraction Spec | 50MB CSV or multi-page PDF parsed to text exceeds Claude claude-sonnet-4-6 context window | Estimate token count before Claude call; if > 150,000 tokens, truncate mappings to most-recently-confirmed 200 labels with warning | `runExtraction` action |
| IN-012 | §8 pipeline step 7 | Two verify sessions for same property confirm simultaneously; both write to `extractorProfile.mappings` | `confirmVerify` reads current mappings and merges new labels; use **patch** not replace to avoid clobbering concurrent writes | `confirmVerify` mutation |
| IN-013 | §6 budgets schema | `budgets.month` stored with value outside 1–12 range via CSV import or direct call | `if (month < 1 \|\| month > 12) throw new ConvexError('month must be 1–12')` | `saveBudgetEntry` + `importBudgetCsv` mutations |
| IN-014 | §8b Step 2 | `ly_otb_at_stay` uses last `paceSnapshot` for `d_ly`, not verified `auditRecord.roomsOccupied` as actuals | `ly_final_rooms = auditRecord(d_ly).roomStatistics.roomsOccupied ?? lastPaceSnapshot(d_ly).roomsOnBooks` | Forecast query |
| IN-015 | §6 properties | `totalRooms` updated upward after audit records exist; historical occupancy exceeds 100% | On `totalRooms` change: warn "N historical records will show recalculated occupancy — some may exceed 100%" | `updateProperty` mutation + Settings UI |
| IN-016 | §8 pipeline step 1 | Lock check query and `generateUploadUrl` are separate Convex operations; race window between them | Combine lock check + `generateUploadUrl` in single mutation: `if (inFlight) throw; else return ctx.storage.generateUploadUrl()` | `generateUploadUrl` mutation |
| IN-017 | §6 auditRecords | `auditDate` stored as string with no ISO-8601 format validation at mutation boundary | `if (!/^\d{4}-(?:0[1-9]\|1[0-2])-(?:0[1-9]\|[12]\d\|3[01])$/.test(auditDate)) throw ConvexError('Invalid date')` | All mutations accepting `auditDate` |
| IN-018 | §6 alerts | Alert re-fired by cron; next day cron sees condition still met; fires again without new dismissal | On re-fire: set `refireAfter = now + 7_days`; require new explicit dismissal before next re-fire cycle | `refireSnoozedAlerts` cron |
| IN-019 | §6 paymentTypes | Multiple `paymentTypes` records have `isDefault=true` for same `propertyId` | Before insert: check no existing default exists for `propertyId`; reject if `isDefault=true` and one already exists | `createPaymentType` mutation |
| IN-020 | §9 File Upload Security | `fileSizeBytes` is client-provided; actual file size in Convex storage never verified server-side | After upload: `const meta = await ctx.storage.getMetadata(storageId)`; compare `meta.size` vs reported size; reject if mismatch | `recordUpload` mutation |
| IN-021 | §8a Extraction Spec | Large categories list + full mappings + 365 pace rows all injected into single Claude system prompt | Measure token count pre-call; if > 150,000 tokens, truncate `mappings` to most-recently-confirmed 200 labels | `runExtraction` action |
| IN-022 | §8a System Prompt | PMS report uses accounting notation `(1,234.56)` for negative amounts; Claude extracts as positive | Add to system prompt: "Parenthesized amounts are negative: (1234.56) must be extracted as -1234.56" | Claude system prompt |
| IN-023 | §8b Step 6 | Actuals sum in forecast includes `auditRecords` with `status: 'draft'` or `'pending_verification'` | Filter: `auditRecord.status === 'verified'` only when summing past actuals for month-end projection | Forecast query |
| IN-024 | §10 Data Retention | 7-year file deletion cron deletes Convex storage objects; corresponding `dataImports` DB records remain stale | On file deletion: `dataImports.storageId = undefined`; add `dataImports.fileDeletedAt` timestamp | File deletion cron |
| IN-025 | §7 Route Protection | Auditor hits role guard redirect; no target route defined for the redirect destination | `throw redirect({ to: '/$propertyId/upload', params: { propertyId: profile.propertyId! } })` | `_app/__layout.tsx` beforeLoad |
| IN-026 | §9 Authentication Flow | `getAuth` server function throws (auth service unavailable); `context.isAuthenticated` is undefined not false | Catch all errors in `getAuth`: return `{ isAuthenticated: false, session: null }`; never propagate auth service errors as 500 | `__root.tsx` server function |
| IN-027 | §6 dataImports | `extractionId` field has no defined purpose; never populated if action crashes before setting it | Define `extractionId` as Convex scheduler job ID returned by `ctx.scheduler.runAfter`; store it to enable cancellation | `runExtraction` action |
| IN-028 | §8 pipeline step 5 | Claude API returns 429 or 503 during extraction; no retry strategy defined | Exponential backoff: 3 retries with 2s/4s/8s delays before marking `status: 'failed'`; log failure reason | `runExtraction` action |

---

*v1.0 — Generated by BMad Master from PRD v1.1 and ECH review (55 findings). Stack: TanStack Start + Convex + Better Auth + Bun + Turborepo + Ultracite.*

*v1.1 — Patched by BMad Master from adversarial review (15 findings). Added: §8a AI Extraction Specification, §8b Forecast Algorithm, corrected paceSnapshot storage scale, resolved malware scan vendor (AWS), added compute cost estimate, added ADR-011 (onboarding time target). Convex backend retained — scale validates choice for Phase 1.*

*v1.2 — Patched by BMad Master from ECH arch review (32 findings). Architectural decisions: ADR-012 (malware scan webhook pattern), ADR-013 (slug uniqueness scoped to companyId), ADR-014 (userProfile onUserCreate hook + schema update), ADR-015 (churned property deletion order). 28 implementation notes added to §12b (IN-001 through IN-028).*
