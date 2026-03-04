# 9. Security Architecture

## Tenant Isolation

Every Convex function resolves the caller's identity via Better Auth:

```typescript
// Standard pattern for all Convex functions:
export const getSomeData = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    const profile = await ctx.db.query("userProfiles")
      .withIndex("by_userId", q => q.eq("userId", identity.subject))
      .first();
    if (!profile) throw new ConvexError("No profile");

    // ADR-014: reject pending_onboarding profiles before any data access
    if (profile.role === "pending_onboarding") throw new ConvexError("Onboarding incomplete");

    // IN-002: auditor with undefined propertyId → actionable error, not silent denial
    if (profile.role === "auditor" && !profile.propertyId) {
      throw new ConvexError("Auditor account not configured — contact your property manager");
    }

    // Auditor: verify they're scoped to this specific property
    if (profile.role === "auditor" && profile.propertyId !== args.propertyId) {
      throw new ConvexError("Access denied");
    }

    // Owner/GM: verify property belongs to their company
    const property = await ctx.db.get(args.propertyId);
    if (!property || property.companyId !== profile.companyId) {
      throw new ConvexError("Access denied");
    }

    // Safe to proceed
  }
});
```

No function accepts `companyId` as a client argument — it is always resolved from the authenticated session.

## Role-Based Access Control

| Role | Accessible Functions |
|------|---------------------|
| Owner | All functions for their company |
| GM | All functions for their assigned property |
| Auditor | `uploads.*`, `verify.*` only — all other functions throw "Access denied" |
| pending_onboarding | No functions — redirected to onboarding wizard |

## User Profile Initialization (ADR-014)

The `onUserCreate` hook in `auth.ts` creates a minimal `userProfile` document atomically on sign-up, before the onboarding wizard assigns a company. This ensures no authenticated user can be in a state where every Convex call fails with "No profile".

```typescript
// auth.ts — explicit onUserCreate hook (ADR-014)
export const auth = betterAuth({
  // ... other config
  plugins: [
    convexPlugin({
      onUserCreate: async ({ user, ctx }) => {
        // Creates placeholder profile — companyId and role set during onboarding wizard
        await ctx.runMutation(internal.userProfiles.createPlaceholder, {
          userId: user.id,
          role: "pending_onboarding",
        });
      },
    }),
  ],
});
```

The sign-in flow verifies profile existence and redirects to onboarding completion if the profile is in `pending_onboarding` state, providing a recovery path if profile creation failed or onboarding was abandoned.

## File Upload Security

1. **Mime type allowlist** — validated server-side in Convex mutation (client mime is untrusted)
2. **Size cap** — `fileSizeBytes < 50_000_000` validated before `generateUploadUrl`
3. **Server-side size verification** — after upload, `ctx.storage.getMetadata(storageId)` is called to verify actual file size matches the client-reported value; mismatches are rejected (IN-020)
4. **Malware scan** — blocking step before extraction proceeds; scan failure = rejection and file deletion (ADR-012)
5. **Convex storage** — files isolated per property; access via generated signed URLs
6. **Storage existence check** — download path checks Convex storage before serving URL (ECH)
7. **No public file URLs** — all file access is through authenticated Convex functions

## Authentication Flow

```
Browser → Better Auth sign-up → onUserCreate hook → placeholder userProfile created
Browser → Better Auth sign-in → JWT token
Token → passed to Convex via ConvexBetterAuthProvider (client)
Token → passed to Convex via createServerFn (SSR: __root.tsx getAuth)
                            → IN-026: catch all errors; return { isAuthenticated: false } on failure
Convex → ctx.auth.getUserIdentity() → validates token per-function
       → profile.role === "pending_onboarding" → redirect to onboarding (ADR-014)
```

---
