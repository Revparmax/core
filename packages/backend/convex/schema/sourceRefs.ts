import { defineTable } from "convex/server";
import { v } from "convex/values";

// Maps imported source-system rows to canonical Convex documents without adding
// legacy IDs to the final product tables.
export const sourceRefs = defineTable({
  source: v.string(),
  sourceTable: v.string(),
  legacyId: v.number(),
  targetTable: v.string(),
  targetId: v.string(),
})
  .index("by_source_table_legacy", ["source", "sourceTable", "legacyId"])
  .index("by_target", ["targetTable", "targetId"]);
