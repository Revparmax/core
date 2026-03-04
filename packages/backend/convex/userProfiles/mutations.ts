import { ConvexError, v } from "convex/values";

import { internalMutation, mutation } from "../_generated/server";

// Called by the onUserCreate hook in auth.ts (ADR-014).
// Creates a minimal placeholder profile so authenticated users always have a profile doc.
// Idempotent — safe to call twice for the same userId (e.g. webhook retry).
export const createPlaceholder = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("userProfiles", {
      userId,
      role: "pending_onboarding",
    });
  },
});

// Called at the end of the onboarding wizard to promote the placeholder profile.
// Sets companyId + role (and optionally propertyId for auditor accounts).
export const completeOnboarding = mutation({
  args: {
    companyId: v.id("companies"),
    role: v.union(v.literal("owner"), v.literal("gm")),
    propertyId: v.optional(v.id("properties")),
  },
  handler: async (ctx, args) => {
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

    await ctx.db.patch(profile._id, {
      companyId: args.companyId,
      role: args.role,
      propertyId: args.propertyId,
    });
  },
});

// Called by GMs to assign or re-assign an auditor to a property (PRD:644).
export const assignAuditor = mutation({
  args: {
    auditorUserId: v.string(),
    propertyId: v.id("properties"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }

    const callerProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .first();

    if (!callerProfile) {
      throw new ConvexError("No profile");
    }
    if (callerProfile.role !== "gm" && callerProfile.role !== "owner") {
      throw new ConvexError("Access denied");
    }

    // Verify the property belongs to the caller's company
    const property = await ctx.db.get(args.propertyId);
    if (!property || property.companyId !== callerProfile.companyId) {
      throw new ConvexError("Access denied");
    }

    const auditorProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.auditorUserId))
      .first();

    if (!auditorProfile) {
      throw new ConvexError("Auditor profile not found");
    }

    await ctx.db.patch(auditorProfile._id, {
      propertyId: args.propertyId,
      role: "auditor",
      companyId: callerProfile.companyId,
    });
  },
});
