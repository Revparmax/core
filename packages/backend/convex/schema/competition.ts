import { defineTable } from "convex/server";
import { v } from "convex/values";

export const competitors = defineTable({
  propertyId: v.id("properties"),
  name: v.string(),
  totalRooms: v.optional(v.number()),
  archivedAt: v.optional(v.number()),
}).index("by_propertyId", ["propertyId"]);

// auditId is optional: competition data can arrive independently of an audit
// (e.g. hourly rate pulls from Expedia/OTA APIs) and should not be forced into
// a daily audit container. capturedAt records the exact moment the data was
// fetched; sourceType distinguishes upload-extracted vs API-sourced records.
export const competitionData = defineTable({
  propertyId: v.id("properties"),
  competitorId: v.id("competitors"),
  capturedAt: v.number(), // unix ms — when this snapshot was taken
  rate: v.optional(v.number()),
  availableRooms: v.optional(v.number()),
  dailyOccupancy: v.optional(v.number()), // 0.0 to 1.0
  sourceType: v.union(
    v.literal("upload"),
    v.literal("api"),
    v.literal("manual")
  ),
  importId: v.optional(v.id("dataImports")), // set for "upload" sourceType
  auditId: v.optional(v.id("auditRecords")), // set when captured via an audit upload
})
  .index("by_propertyId_capturedAt", ["propertyId", "capturedAt"])
  .index("by_competitorId_capturedAt", ["competitorId", "capturedAt"])
  .index("by_auditId", ["auditId"]); // retained for upload-sourced lookups
