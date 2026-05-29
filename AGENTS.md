# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `bun x ultracite fix`
- **Check for issues**: `bun x ultracite check`
- **Diagnose setup**: `bun x ultracite doctor`

Biome (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Temporary Local App Runbook

This is the current local setup for the RevParMax review UI while the legacy
read model is being migrated. It is intentionally temporary and more complex
than it should be.

### Local Data

- Local Convex data lives under `packages/backend/.convex/local/default/`.
- The SQLite DB file is
  `packages/backend/.convex/local/default/convex_local_backend.sqlite3`.
- Local Convex file/search/module storage lives in
  `packages/backend/.convex/local/default/convex_local_storage/`.
- The `legacy*` tables are frozen extract tables only. Product UI/API paths
  should read canonical tables populated by conversion tools, not raw legacy
  tables.

### Bring Up Services

Start Convex first:

```bash
cd packages/backend
env TMPDIR=/tmp CONVEX_AGENT_MODE=anonymous bunx convex dev --typecheck disable --tail-logs disable
```

Expected Convex URLs:

- Convex API: `http://127.0.0.1:3210`
- Convex site proxy: `http://127.0.0.1:3211`

If canonical data is missing, run the importer:

```bash
cd packages/backend
CONVEX_URL=http://127.0.0.1:3210 bun scripts/canonicalize-legacy-read-model.ts --company-ids 4,103 --convex-url http://127.0.0.1:3210
```

Start the production-facing API:

```bash
env TMPDIR=/tmp CONVEX_URL=http://127.0.0.1:3210 REVPARMAX_API_PORT=8798 bun --filter api start
```

Start the migration/debug bridge inspector:

```bash
cd apps/legacy-bridge
env TMPDIR=/tmp CONVEX_URL=http://127.0.0.1:3210 PORT=8799 bun src/server.ts
```

Start the web app for Tailscale browser access:

```bash
env __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=avicenx.tailff2a5.ts.net VITE_CONVEX_URL=https://avicenx.tailff2a5.ts.net:3210 VITE_CONVEX_SITE_URL=https://avicenx.tailff2a5.ts.net:3211 bun --filter web dev --host 127.0.0.1 --port 5173
```

Current useful URLs:

- Review UI: `https://avicenx.tailff2a5.ts.net:5173/review`
- Production API health: `https://avicenx.tailff2a5.ts.net:8798/health`
- Production API companies: `https://avicenx.tailff2a5.ts.net:8798/companies`
- Bridge inspector: `https://avicenx.tailff2a5.ts.net:8799/inspector`

Tailscale serve mappings used for this setup:

```bash
sudo tailscale serve --bg --https=5173 5173
sudo tailscale serve --bg --https=3210 3210
sudo tailscale serve --bg --https=3211 3211
sudo tailscale serve --bg --https=8798 8798
sudo tailscale serve --bg --https=8799 8799
```

### Simplification Target

This should become one checked-in command, for example `bun run dev:review`,
that starts Convex, the API, the web app, and optionally the bridge with shared
env defaults. The repo should also have a committed `.env.example` for these
ports and a small health check that verifies Convex, `/companies`, `/review`,
and `/inspector` before handing links to the user.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**

- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `bun x ultracite fix` before committing to ensure compliance.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
