import { ConvexError } from "convex/values";

import type { MutationCtx, QueryCtx } from "../_generated/server";

// Resolves the authenticated user's profile and enforces baseline guards
// present in every Convex function (§9 Security Architecture).
//
// Throws:
//   "Unauthenticated"           — no valid JWT
//   "No profile"                — user exists in Better Auth but has no userProfile doc
//   "Onboarding incomplete"     — pending_onboarding role; redirect to wizard (ADR-014)
export async function requireUserProfile(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Unauthenticated");
  }

  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
    .first();

  if (!profile) {
    throw new ConvexError("No profile");
  }
  if (profile.role === "pending_onboarding") {
    throw new ConvexError("Onboarding incomplete");
  }

  return { profile, userId: identity.subject };
}
