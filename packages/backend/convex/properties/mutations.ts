import { ConvexError, v } from "convex/values";

import { mutation } from "../_generated/server";
import { requireUserProfile } from "../lib/withAuth";

// Regex constants at module level per linting rules.
const SLUG_NON_WORD = /[^\w\s-]/g;
const SLUG_SPACES = /[\s_]+/g;
const SLUG_TRIM_DASHES = /^-+|-+$/g;

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(SLUG_NON_WORD, "")
    .replace(SLUG_SPACES, "-")
    .replace(SLUG_TRIM_DASHES, "");
}

// Creates a property for the authenticated user's company.
// ADR-013: slug uniqueness is scoped to (companyId, slug) — not global.
export const createProperty = mutation({
  args: {
    name: v.string(),
    totalRooms: v.number(),
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireUserProfile(ctx);

    if (profile.role !== "owner" && profile.role !== "gm") {
      throw new ConvexError("Access denied");
    }

    const companyId = profile.companyId;
    if (!companyId) {
      throw new ConvexError("Account setup incomplete");
    }

    const trimmedName = args.name.trim();
    if (trimmedName.length === 0) {
      throw new ConvexError("Property name cannot be blank");
    }

    if (args.totalRooms < 1) {
      throw new ConvexError("totalRooms must be at least 1");
    }

    const slug = slugify(trimmedName);

    // ADR-013: uniqueness check within company only
    const existing = await ctx.db
      .query("properties")
      .withIndex("by_companyId_slug", (q) =>
        q.eq("companyId", companyId).eq("slug", slug)
      )
      .first();

    if (existing) {
      throw new ConvexError(
        "A property with this name already exists for your company"
      );
    }

    return await ctx.db.insert("properties", {
      companyId,
      name: trimmedName,
      slug,
      totalRooms: args.totalRooms,
      timezone: args.timezone,
      status: "pending_first_upload",
      // Alert threshold defaults
      varianceThresholdPct: 10,
      varianceConsecutiveDays: 3,
      paceYellowThresholdPct: 10,
      paceRedThresholdPct: 10,
      pickupVelocityThresholdPct: 50,
    });
  },
});

// Updates mutable property fields. Alert threshold changes validated here.
export const updateProperty = mutation({
  args: {
    propertyId: v.id("properties"),
    name: v.optional(v.string()),
    totalRooms: v.optional(v.number()),
    timezone: v.optional(v.string()),
    varianceThresholdPct: v.optional(v.number()),
    varianceConsecutiveDays: v.optional(v.number()),
    paceYellowThresholdPct: v.optional(v.number()),
    paceRedThresholdPct: v.optional(v.number()),
    pickupVelocityThresholdPct: v.optional(v.number()),
  },
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: each branch validates one optional field; extraction would obscure intent
  handler: async (ctx, args) => {
    const { profile } = await requireUserProfile(ctx);

    const property = await ctx.db.get(args.propertyId);
    if (!property || property.companyId !== profile.companyId) {
      throw new ConvexError("Access denied");
    }

    if (profile.role !== "owner" && profile.role !== "gm") {
      throw new ConvexError("Access denied");
    }

    const patch: Partial<typeof property> = {};

    if (args.name !== undefined) {
      const trimmedName = args.name.trim();
      if (trimmedName.length === 0) {
        throw new ConvexError("Property name cannot be blank");
      }
      patch.name = trimmedName;
    }

    if (args.totalRooms !== undefined) {
      if (args.totalRooms < 1) {
        throw new ConvexError("totalRooms must be at least 1");
      }
      patch.totalRooms = args.totalRooms;
    }

    if (args.timezone !== undefined) {
      patch.timezone = args.timezone;
    }

    if (args.varianceThresholdPct !== undefined) {
      if (args.varianceThresholdPct < 1) {
        throw new ConvexError("varianceThresholdPct must be at least 1");
      }
      patch.varianceThresholdPct = args.varianceThresholdPct;
    }

    if (args.varianceConsecutiveDays !== undefined) {
      patch.varianceConsecutiveDays = args.varianceConsecutiveDays;
    }

    // Validate yellow > red threshold (ECH)
    const yellowPct =
      args.paceYellowThresholdPct ?? property.paceYellowThresholdPct;
    const redPct = args.paceRedThresholdPct ?? property.paceRedThresholdPct;
    if (yellowPct <= redPct) {
      throw new ConvexError(
        "paceYellowThresholdPct must be greater than paceRedThresholdPct"
      );
    }

    if (args.paceYellowThresholdPct !== undefined) {
      patch.paceYellowThresholdPct = args.paceYellowThresholdPct;
    }
    if (args.paceRedThresholdPct !== undefined) {
      patch.paceRedThresholdPct = args.paceRedThresholdPct;
    }
    if (args.pickupVelocityThresholdPct !== undefined) {
      patch.pickupVelocityThresholdPct = args.pickupVelocityThresholdPct;
    }

    await ctx.db.patch(args.propertyId, patch);
  },
});
