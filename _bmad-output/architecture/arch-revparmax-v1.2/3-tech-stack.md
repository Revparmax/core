# 3. Tech Stack

## Frontend

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

## Backend (Convex)

| Layer | Choice | Notes |
|-------|--------|-------|
| Runtime | Convex | Serverless functions (query / mutation / action) |
| Database | Convex (document store) | Reactive, TypeScript-typed schema |
| Auth | Better Auth + `@convex-dev/better-auth` | Component registered in `convex.config.ts` |
| File Storage | Convex Storage | `generateUploadUrl` → direct upload → `storageId` |
| Job Scheduling | Convex Scheduler + Crons | Replaces Redis/BullMQ |
| AI / LLM | Claude claude-sonnet-4-6 (Anthropic) | Called from Convex actions |
| Validation | Zod (shared with frontend) | Used in action arg validators |

## Monorepo Tooling

| Tool | Purpose |
|------|---------|
| Bun | Package manager + runtime |
| Turborepo | Monorepo task orchestration |
| Ultracite (Biome) | Lint + format (already configured) |
| Husky + lint-staged | Pre-commit hooks |
| TypeScript 5 | Shared types across packages |

---
