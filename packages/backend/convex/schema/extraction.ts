import { defineTable } from "convex/server";
import { v } from "convex/values";

// mappings values MUST be validated as valid Id<"revenueCategories"> before write (IN-001).
export const extractorProfiles = defineTable({
  propertyId: v.id("properties"),
  mappings: v.record(v.string(), v.string()), // Record<sourceLabel, categoryId>
  confirmedAt: v.optional(v.number()),
}).index("by_propertyId", ["propertyId"]);

// Persisted 24hr for verify-flow resume after browser close (ADR-006).
// by_expiresAt index used by nightly cleanup cron (IN-004).
export const extractionResults = defineTable({
  importId: v.id("dataImports"),
  propertyId: v.id("properties"),
  status: v.union(
    v.literal("pending"),
    v.literal("ready_for_verify"),
    v.literal("verified"),
    v.literal("failed"),
    v.literal("timeout")
  ),
  extractedFields: v.array(
    v.object({
      field: v.string(),
      value: v.union(v.string(), v.number(), v.null()),
      confidence: v.number(),
      label: v.string(),
    })
  ),
  proposedMappings: v.array(
    v.object({
      sourceLabel: v.string(),
      proposedCategoryId: v.union(v.string(), v.null()),
      amount: v.number(),
      confidence: v.number(),
    })
  ),
  payments: v.array(
    v.object({
      paymentType: v.string(),
      amount: v.number(),
      confidence: v.number(),
    })
  ),
  paceSnapshot: v.array(
    v.object({
      forecastDate: v.string(),
      roomsOnBooks: v.number(),
      adr: v.union(v.number(), v.null()),
      confidence: v.number(),
    })
  ),
  expiresAt: v.number(), // unix ms; 24hr from extraction time
  auditDate: v.optional(v.string()),
  reportType: v.optional(v.string()),
})
  .index("by_importId", ["importId"])
  .index("by_propertyId", ["propertyId"])
  .index("by_expiresAt", ["expiresAt"]); // IN-004: cleanup cron
