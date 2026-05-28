import { defineTable } from "convex/server";
import { v } from "convex/values";

// Compact daily pace read model. One document stores the forward-looking pace
// window captured for a property on a given snapshot date.
export const paceSnapshotDays = defineTable({
  propertyId: v.id("properties"),
  companyId: v.id("companies"),
  snapshotDate: v.string(),
  source: v.string(),
  legacyAuditId: v.number(),
  entries: v.array(
    v.object({
      forDate: v.string(),
      roomsOnBooks: v.number(),
      adr: v.optional(v.number()),
    })
  ),
})
  .index("by_property_snapshot", ["propertyId", "snapshotDate"])
  .index("by_company_snapshot", ["companyId", "snapshotDate"])
  .index("by_legacyAuditId", ["legacyAuditId"]);
