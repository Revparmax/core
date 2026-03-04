# 1. System Overview

RevParMax is a multi-tenant SaaS platform for hotel ownership groups. It ingests nightly audit reports from property management systems (PMS), extracts structured data via an AI pipeline, and surfaces operational intelligence through an owner dashboard.

## System Boundaries

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

## User Roles (PRD §4)

| Role | Scope | Primary Surface |
|------|-------|-----------------|
| Owner / Ownership Group | Portfolio — all properties | Dashboard, Forecast, Budget, Alerts |
| Night Auditor | Single property | Upload + Verify flow only |
| General Manager | Single property | Full property view, Settings, Onboarding |

## Key Constraints

- **Phase 1:** Single nightly source per property per day; multi-source is a future extension
- **Single currency:** USD only (V1)
- **No channel management:** analytics and forecasting layer only; no rate pushing
- **Tenant isolation:** No cross-property data access; auditors scoped to one property
- **Scale target:** 500+ properties without schema changes

---
