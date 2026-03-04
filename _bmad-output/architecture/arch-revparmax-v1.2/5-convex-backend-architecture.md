# 5. Convex Backend Architecture

## Function Types

| Type | Use | Notes |
|------|-----|-------|
| `query` | Read data, reactive subscription | Called from React via `useQuery` / React Query |
| `mutation` | Transactional writes | Atomic across multiple tables in one call |
| `action` | External API calls (AI, file scan) | Not reactive; triggers mutations to write results |
| `internalQuery/Mutation/Action` | Called server-to-server only | Not exposed to client |
| `httpAction` | HTTP endpoint | Used for Better Auth routes + malware scan webhook (ADR-012) |

## Feature Module Layout

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

## Cron Jobs (`crons.ts`)

```typescript
// Nightly alert evaluation — runs at 6am per property timezone
// (approximated as UTC; property-specific scheduling in Phase 2)
crons.daily("evaluate-variance-alerts", { hourUTC: 10 }, internal.alerts.evaluateVarianceAlerts);
crons.daily("evaluate-pickup-alerts",   { hourUTC: 10 }, internal.alerts.evaluatePickupAlerts);

// Living snapshot archival — triggered after each verified submission via scheduler,
// not as a cron (immediate, per submission)

// Re-fire dismissed alerts — daily sweep for snoozed alerts past their re_fire_after date
crons.daily("refire-dismissed-alerts", { hourUTC: 10 }, internal.alerts.refireSnoozedAlerts);

// Malware scan timeout guard — marks pending scans as scan_failed after 15 min (ADR-012)
crons.interval("scan-timeout-guard", { minutes: 5 }, internal.uploads.markStaleScansFailed);

// Expired extraction results cleanup (IN-004)
crons.daily("cleanup-expired-extractions", { hourUTC: 3 }, internal.ingestion.deleteExpiredResults);

// Orphaned storage cleanup — deletes storageIds absent from any dataImports record after 1hr (IN-005)
crons.hourly("cleanup-orphaned-storage", internal.uploads.deleteOrphanedStorage);
```

## Scheduled Functions (Scheduler)

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
