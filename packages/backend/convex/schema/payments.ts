import { defineTable } from "convex/server";
import { v } from "convex/values";

// propertyId null = global default type.
// Only one isDefault=true record allowed per propertyId (IN-019).
export const paymentTypes = defineTable({
  propertyId: v.optional(v.id("properties")),
  name: v.string(),
  isDefault: v.boolean(),
  archivedAt: v.optional(v.number()),
}).index("by_propertyId", ["propertyId"]);

export const paymentRecords = defineTable({
  auditId: v.id("auditRecords"),
  propertyId: v.id("properties"),
  paymentTypeId: v.id("paymentTypes"),
  amount: v.number(),
  source: v.string(),
}).index("by_auditId", ["auditId"]);
