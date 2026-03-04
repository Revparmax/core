import { query } from "../_generated/server";
import { requireUserProfile } from "../lib/withAuth";

// Returns the authenticated user's profile.
// Used by the frontend to determine onboarding state and role.
export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    return await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .first();
  },
});

// Returns the current user's profile only if onboarding is complete.
// Throws "Unauthenticated", "No profile", or "Onboarding incomplete" otherwise.
export const getMyCompletedProfile = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireUserProfile(ctx);
    return profile;
  },
});
