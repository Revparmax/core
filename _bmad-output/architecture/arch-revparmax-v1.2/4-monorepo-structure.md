# 4. Monorepo Structure

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
│   │       ├── auth.ts               # Better Auth setup + onUserCreate hook (ADR-014)
│   │       ├── auth.config.ts        # Auth config
│   │       ├── http.ts               # HTTP router (Better Auth handler + malware scan webhook — ADR-012)
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
