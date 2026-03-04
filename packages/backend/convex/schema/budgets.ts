import { defineTable } from "convex/server";
import { v } from "convex/values";

// month validated: 1–12 at every mutation boundary (IN-013).
// isOriginal rows are read-only once the fiscal year is locked (ADR-009).
export const budgets = defineTable({
  propertyId: v.id("properties"),
  companyId: v.id("companies"),
  fiscalYear: v.number(),
  month: v.number(), // 1–12
  categoryId: v.optional(v.id("revenueCategories")), // null = rooms budget
  budgetOccupancy: v.optional(v.number()), // 0.0 to 1.0
  budgetAdr: v.optional(v.number()),
  budgetAmount: v.optional(v.number()),
  isOriginal: v.boolean(), // read-only once fiscal year locked (ADR-009)
  lockedAt: v.optional(v.number()),
})
  .index("by_propertyId_year", ["propertyId", "fiscalYear"])
  .index("by_property_year_month_category", [
    "propertyId",
    "fiscalYear",
    "month",
    "categoryId",
  ]);
