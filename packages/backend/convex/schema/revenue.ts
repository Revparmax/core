import { defineTable } from "convex/server";
import { v } from "convex/values";

// Hard delete blocked if nonRoomRevenue docs reference a category (ADR-005).
export const revenueParentCategories = defineTable({
  propertyId: v.id("properties"),
  companyId: v.id("companies"),
  name: v.string(),
  displayOrder: v.number(),
  archivedAt: v.optional(v.number()), // soft delete — never hard-delete
}).index("by_propertyId", ["propertyId"]);

export const revenueCategories = defineTable({
  propertyId: v.id("properties"),
  companyId: v.id("companies"),
  parentId: v.optional(v.id("revenueParentCategories")),
  name: v.string(),
  displayOrder: v.number(),
  archivedAt: v.optional(v.number()),
})
  .index("by_propertyId", ["propertyId"])
  .index("by_propertyId_name", ["propertyId", "name"]); // case-insensitive uniqueness in mutation

export const nonRoomRevenue = defineTable({
  auditId: v.id("auditRecords"),
  propertyId: v.id("properties"),
  categoryId: v.id("revenueCategories"),
  amount: v.number(), // negatives allowed (refunds)
  source: v.string(), // raw label from the source file/system
  importId: v.optional(v.id("dataImports")), // null for api/manual sources
  sourceType: v.union(
    v.literal("upload"),
    v.literal("api"),
    v.literal("manual")
  ),
})
  .index("by_auditId", ["auditId"])
  .index("by_propertyId_categoryId", ["propertyId", "categoryId"]);
