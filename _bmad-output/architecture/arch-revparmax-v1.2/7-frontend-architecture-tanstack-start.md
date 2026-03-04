# 7. Frontend Architecture (TanStack Start)

## Route Structure

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

## Data Fetching Pattern

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

## Server Functions (SSR Auth)

TanStack Start `createServerFn` is used only where SSR needs auth context (e.g. initial token hydration in `__root.tsx`). Most data loading uses Convex queries directly.

```typescript
// __root.tsx — already scaffolded pattern:
const getAuth = createServerFn({ method: "GET" }).handler(async () => {
  return await getToken(); // from auth-server.ts
});
```

## Route Protection

Auth guard lives in the `_app/__layout.tsx` `beforeLoad`:

```typescript
beforeLoad: async ({ context }) => {
  if (!context.isAuthenticated) {
    throw redirect({ to: "/sign-in" });
  }
  // Auditor role guard: redirect to upload route for their assigned property (IN-025)
  // if (profile.role === 'auditor') throw redirect({ to: '/$propertyId/upload', params: ... })
}
```

---
