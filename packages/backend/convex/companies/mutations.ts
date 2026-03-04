import { ConvexError, v } from "convex/values";

import { mutation } from "../_generated/server";

// Creates a new company and returns its ID.
// Called from onboarding step 1. The caller's userProfile is updated separately
// via userProfiles.completeOnboarding once both company and first property exist.
export const createCompany = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, { name }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }

    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new ConvexError("Company name cannot be blank");
    }

    return await ctx.db.insert("companies", { name: trimmed });
  },
});
