import { v } from "convex/values";

import { internalQuery } from "../_generated/server";

// Returns the raw dataImports doc needed before extraction starts.
export const getImportForExtraction = internalQuery({
  args: { importId: v.id("dataImports") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.importId);
  },
});

// Returns property, revenue categories, and extractor profile for building
// the Claude system prompt.
export const getExtractionContext = internalQuery({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const property = await ctx.db.get(args.propertyId);

    const categories = await ctx.db
      .query("revenueCategories")
      .withIndex("by_propertyId", (q) => q.eq("propertyId", args.propertyId))
      .filter((q) => q.eq(q.field("archivedAt"), undefined))
      .collect();

    const extractorProfile = await ctx.db
      .query("extractorProfiles")
      .withIndex("by_propertyId", (q) => q.eq("propertyId", args.propertyId))
      .first();

    return { property, categories, extractorProfile };
  },
});
