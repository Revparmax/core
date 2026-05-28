import { defineTable } from "convex/server";
import { v } from "convex/values";

// Joined, review-friendly audit read model built from immutable legacy* rows.
export const legacyAuditSnapshots = defineTable({
  legacyAuditId: v.number(),
  legacyCompanyId: v.number(),
  auditDate: v.string(),
  snapshot: v.any(),
})
  .index("by_legacyAuditId", ["legacyAuditId"])
  .index("by_company_date", ["legacyCompanyId", "auditDate"]);
