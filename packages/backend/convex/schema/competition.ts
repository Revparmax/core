import { defineTable } from "convex/server";
import { v } from "convex/values";

export const competitors = defineTable({
  propertyId: v.id("properties"),
  name: v.string(),
  totalRooms: v.optional(v.number()),
  archivedAt: v.optional(v.number()),
}).index("by_propertyId", ["propertyId"]);

export const competitionData = defineTable({
  auditId: v.id("auditRecords"),
  propertyId: v.id("properties"),
  competitorId: v.id("competitors"),
  rate: v.optional(v.number()),
  availableRooms: v.optional(v.number()),
  dailyOccupancy: v.optional(v.number()), // 0.0 to 1.0
})
  .index("by_auditId", ["auditId"])
  .index("by_competitorId_auditId", ["competitorId", "auditId"]);
