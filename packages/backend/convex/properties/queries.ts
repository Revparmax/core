import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { requireUserProfile } from "../lib/withAuth";

// Lists all properties for the authenticated user's company.
// Auditors receive only their assigned property.
export const listMyProperties = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireUserProfile(ctx);

    if (!profile.companyId) {
      return [];
    }

    if (profile.role === "auditor") {
      if (!profile.propertyId) {
        throw new ConvexError(
          "Auditor account not configured — contact your property manager"
        );
      }
      const property = await ctx.db.get(profile.propertyId);
      return property ? [property] : [];
    }

    // profile.companyId is guaranteed non-null: early return above handles null
    const { companyId } = profile;
    return await ctx.db
      .query("properties")
      .withIndex("by_companyId", (q) => q.eq("companyId", companyId))
      .collect();
  },
});

// Returns a single property, enforcing tenant and auditor scope.
export const getProperty = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    const { profile } = await requireUserProfile(ctx);

    // Auditor scope: can only read their assigned property
    if (profile.role === "auditor") {
      if (!profile.propertyId) {
        throw new ConvexError(
          "Auditor account not configured — contact your property manager"
        );
      }
      if (profile.propertyId !== args.propertyId) {
        throw new ConvexError("Access denied");
      }
    }

    const property = await ctx.db.get(args.propertyId);

    // Tenant isolation: property must belong to caller's company
    if (!property || property.companyId !== profile.companyId) {
      return null;
    }

    return property;
  },
});
