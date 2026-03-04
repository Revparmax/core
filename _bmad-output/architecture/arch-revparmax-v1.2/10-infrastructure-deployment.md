# 10. Infrastructure & Deployment

## Phase 1 Architecture

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

## Environment Variables

```
# packages/backend/.env.local
CONVEX_DEPLOYMENT=...
SITE_URL=https://app.revparmax.com
MALWARE_SCAN_WEBHOOK_SECRET=...   # ADR-012: validates inbound GuardDuty webhook payloads

# apps/web/.env.local
VITE_CONVEX_URL=https://....convex.cloud
VITE_SITE_URL=https://app.revparmax.com
```

## Monitoring

- **Convex Dashboard** — function logs, error rates, query performance
- **Sentry** — frontend error tracking + source maps
- **Axiom** — structured log ingestion from Convex action logs
- **Uptime alert** — Convex webhook or cron: alert if property has no verified submission for 28+ hours

## Data Retention

- Convex documents: retained per Convex plan limits; living snapshots retained indefinitely
- File storage (Convex): 7-year retention enforced via manual deletion cron at `creationTime + 7yr`; on deletion, `dataImports.storageId` is set to `undefined` and `dataImports.fileDeletedAt` is set (IN-024)
- Churned properties: 90-day retention cron marks property `inactive`, then hard-deletes all documents in the following order (ADR-015):

```
Churned property deletion sequence (ADR-015):
  1. nonRoomRevenue         (orphan-safe: references auditId)
  2. roomStatistics         (orphan-safe: references auditId)
  3. paymentRecords         (orphan-safe: references auditId)
  4. competitionData        (orphan-safe: references auditId)
  5. auditRecords           (now safe: all child records deleted)
  6. dataImports            (delete Convex storage objects first, then records)
  7. paceSnapshots
  8. extractionResults
  9. extractorProfiles
 10. budgets
 11. alerts
 12. revenueCategories
 13. revenueParentCategories
 14. paymentTypes
 15. competitors
 16. property document

Each step is a separate scheduled batch mutation. Steps execute sequentially
via Convex scheduler chains. No concurrent reader can observe a partial state
beyond the boundary between two completed steps.
```

## Storage Scale — Corrected Estimate

> **Note:** The PRD §5 storage estimate of "~1,825 snapshot rows/property/year" is incorrect. The Living Snapshot stores 365 forward-looking rows **per property per day** (one snapshot of the full 365-day pace window). Correct scale:
>
> - **133,225 rows/property/year** (365 rows/day × 365 days)
> - At 50 properties (realistic Phase 1 ceiling): ~6.7M rows/year
> - At 200 properties: ~26.6M rows/year
> - At 500 properties: ~66.6M rows/year
>
> Convex handles this volume without issue at Phase 1 scale (≤ 50 properties). Indexes on `(propertyId, forecastDate)` and `(propertyId, snapshotDate)` ensure forecast queries remain within the 500ms SLA. No archival strategy is needed for Phase 1. Revisit at 200+ properties.

## Malware Scan Vendor — Resolved (ADR-012)

**Decision:** AWS Malware Protection for S3 (via Amazon GuardDuty), with **webhook-based result delivery**.

**Rationale:** Convex Storage uses S3-compatible object storage; files can be scanned via GuardDuty Malware Protection. Managed service with predictable latency, no infrastructure to operate. ClamAV requires a self-managed sidecar — eliminated.

**Integration (ADR-012):** After `recordUpload` stores the `storageId`, the `runMalwareScan` action retrieves the file URL and submits it to GuardDuty Malware Protection, storing the returned `scanJobId` on the `dataImports` record. GuardDuty delivers findings **asynchronously** via SNS + EventBridge to a POST endpoint registered as an `internalHttpAction` in `http.ts` at path `/api/malware-scan-result`. The webhook handler validates the payload signature, reads the `scanJobId` to look up the `dataImports` record, and calls an `internalMutation` to update `scanStatus`. Polling from a Convex action is not used — GuardDuty does not expose a synchronous poll API; the scan result is delivered as an event.

```typescript
// http.ts — malware scan result webhook (ADR-012)
http.route({
  path: "/api/malware-scan-result",
  method: "POST",
  handler: httpRouter(internal.uploads.handleScanWebhook),
});
```

A 5-minute cron (`scan-timeout-guard`) marks any `dataImports` record with `scanStatus: "pending"` and `_creationTime` older than 15 minutes as `scan_failed`, ensuring the pipeline cannot stall indefinitely if the webhook is never delivered.

## Phase 1 AI Compute Cost Estimate

| Unit | Estimate |
|---|---|
| Tokens per nightly upload (input + output) | ~3,000–5,000 tokens |
| Cost per upload (Claude claude-sonnet-4-6) | ~$0.02–$0.05 |
| 50 properties × 30 nights/month | ~$30–$75/month |
| 200 properties | ~$120–$300/month |

This is a known, bounded cost. At a per-property subscription price of $X/month, AI extraction costs are < 5% of revenue at any realistic Phase 1 price point. No per-property compute budget controls are required in Phase 1.

---
