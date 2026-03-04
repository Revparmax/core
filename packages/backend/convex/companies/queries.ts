import { v } from "convex/values";

import { query } from "../_generated/server";
import { requireUserProfile } from "../lib/withAuth";

// Returns the authenticated user's company.
// No companyId arg — always resolved from session (§9 Security Architecture).
export const getMyCompany = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireUserProfile(ctx);

    if (!profile.companyId) {
      return null;
    }

    return await ctx.db.get(profile.companyId);
  },
});

// Returns a specific company by ID — only accessible if it matches the caller's company.
export const getCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const { profile } = await requireUserProfile(ctx);

    if (profile.companyId !== args.companyId) {
      return null;
    }

    return await ctx.db.get(args.companyId);
  },
});
