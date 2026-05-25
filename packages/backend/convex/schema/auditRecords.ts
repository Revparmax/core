import { defineTable } from "convex/server";
import { v } from "convex/values";

// (propertyId, auditDate) uniqueness enforced in createAuditRecord mutation (ADR-002).
// auditDate validated by ISO-8601 regex at every mutation boundary (IN-017).
export const auditRecords = defineTable({
  propertyId: v.id("properties"),
  companyId: v.id("companies"),
  auditDate: v.string(), // "YYYY-MM-DD" in property's local timezone
  source: v.union(v.literal("upload"), v.literal("manual")),
  status: v.union(
    v.literal("draft"),
    v.literal("pending_verification"),
    v.literal("verified"),
    v.literal("overwritten")
  ),
  dataImportId: v.optional(v.id("dataImports")),
  submittedBy: v.string(),
  verifiedBy: v.optional(v.string()),
  verifiedAt: v.optional(v.number()),
})
  .index("by_propertyId_date", ["propertyId", "auditDate"])
  .index("by_companyId", ["companyId"]);

// roomRevenue is NEVER stored — derived as adr * roomsOccupied at query time (ADR-003).
// totalRooms is snapshotted from the property at confirm time so that historical
// occupancy % calculations remain accurate if the property's room count changes later
// (e.g. after a renovation).
// importId + sourceType track which upload (or future API/manual entry) contributed
// this record, supporting multi-source audit days.
export const roomStatistics = defineTable({
  auditId: v.id("auditRecords"),
  propertyId: v.id("properties"),
  totalRooms: v.number(), // snapshotted from property at confirm time
  roomsOccupied: v.number(), // >= 0
  adr: v.number(), // >= 0
  sameDayCancellations: v.number(),
  noShows: v.number(),
  compRooms: v.number(),
  oooRooms: v.number(),
  importId: v.optional(v.id("dataImports")), // null for api/manual sources
  sourceType: v.union(
    v.literal("upload"),
    v.literal("api"),
    v.literal("manual")
  ),
})
  .index("by_auditId", ["auditId"])
  .index("by_propertyId", ["propertyId"]);
