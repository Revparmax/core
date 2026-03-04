import { defineTable } from "convex/server";
import { v } from "convex/values";

// Slug uniqueness scoped to (companyId, slug) — not global (ADR-013).
// Uniqueness check in createProperty mutation: .eq('companyId',...).eq('slug',...).
export const properties = defineTable({
  companyId: v.id("companies"),
  name: v.string(), // validated: trim().length > 0
  slug: v.string(), // derived from trimmed name; unique within company (ADR-013)
  totalRooms: v.number(), // validated: >= 1
  timezone: v.string(), // e.g. "America/New_York"
  status: v.union(
    v.literal("pending_first_upload"),
    v.literal("active"),
    v.literal("inactive")
  ),
  // Alert thresholds — configurable per property
  varianceThresholdPct: v.number(), // default 10; validated >= 1
  varianceConsecutiveDays: v.number(), // default 3
  paceYellowThresholdPct: v.number(), // default 10; validated > redThreshold
  paceRedThresholdPct: v.number(), // default 10
  pickupVelocityThresholdPct: v.number(), // default 50
})
  .index("by_companyId", ["companyId"])
  .index("by_companyId_slug", ["companyId", "slug"]); // ADR-013: uniqueness scoped to company
