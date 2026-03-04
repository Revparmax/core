import { defineTable } from "convex/server";
import { v } from "convex/values";

// lastFiredAt enforces 7-day re-fire dampening after dismissal (IN-018).
export const alerts = defineTable({
  propertyId: v.id("properties"),
  companyId: v.id("companies"),
  type: v.union(
    v.literal("variance"),
    v.literal("pickup_velocity"),
    v.literal("custom")
  ),
  status: v.union(
    v.literal("active"),
    v.literal("dismissed"),
    v.literal("resolved"),
    v.literal("snoozed")
  ),
  triggeredAt: v.number(),
  dismissedAt: v.optional(v.number()),
  dismissedBy: v.optional(v.string()),
  resolvedAt: v.optional(v.number()),
  refireAfter: v.optional(v.number()),
  lastFiredAt: v.optional(v.number()), // IN-018: dampening guard
  payload: v.object({
    signal: v.string(),
    context: v.string(),
    action: v.string(),
  }),
  relatedDate: v.optional(v.string()),
  relatedDateEnd: v.optional(v.string()),
})
  .index("by_propertyId_status", ["propertyId", "status"])
  .index("by_companyId_status", ["companyId", "status"]);
