import { ConvexError, v } from "convex/values";

import { query } from "../_generated/server";
import { requireUserProfile } from "../lib/withAuth";

// Returns all data needed to render the verify screen:
// extraction result, file preview URL, revenue categories, and property name.
export const getVerifyData = query({
  args: { importId: v.id("dataImports") },
  handler: async (ctx, args) => {
    const { profile } = await requireUserProfile(ctx);

    const dataImport = await ctx.db.get(args.importId);
    if (!dataImport || dataImport.companyId !== profile.companyId) {
      throw new ConvexError("Import not found");
    }

    const extractionResult = await ctx.db
      .query("extractionResults")
      .withIndex("by_importId", (q) => q.eq("importId", args.importId))
      .first();

    const property = await ctx.db.get(dataImport.propertyId);

    const categories = await ctx.db
      .query("revenueCategories")
      .withIndex("by_propertyId", (q) =>
        q.eq("propertyId", dataImport.propertyId)
      )
      .filter((q) => q.eq(q.field("archivedAt"), undefined))
      .collect();

    // Generate a temporary signed URL for the file preview (null if file deleted).
    const fileUrl = dataImport.storageId
      ? await ctx.storage.getUrl(dataImport.storageId)
      : null;

    return {
      dataImport,
      extractionResult: extractionResult ?? null,
      property,
      categories,
      fileUrl,
    };
  },
});

// Returns a single dataImports record plus its matching extractionResults doc.
// Enforces tenant isolation via companyId.
export const getImport = query({
  args: { importId: v.id("dataImports") },
  handler: async (ctx, args) => {
    const { profile } = await requireUserProfile(ctx);

    const dataImport = await ctx.db.get(args.importId);
    if (!dataImport || dataImport.companyId !== profile.companyId) {
      throw new ConvexError("Import not found");
    }

    const extractionResult = await ctx.db
      .query("extractionResults")
      .withIndex("by_importId", (q) => q.eq("importId", args.importId))
      .first();

    return { dataImport, extractionResult: extractionResult ?? null };
  },
});

// Returns the 20 most recent imports for a property, newest first.
export const listImportsForProperty = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const { profile } = await requireUserProfile(ctx);

    const property = await ctx.db.get(args.propertyId);
    if (!property || property.companyId !== profile.companyId) {
      throw new ConvexError("Property not found");
    }

    const imports = await ctx.db
      .query("dataImports")
      .withIndex("by_propertyId", (q) => q.eq("propertyId", args.propertyId))
      .order("desc")
      .take(20);

    return imports;
  },
});
