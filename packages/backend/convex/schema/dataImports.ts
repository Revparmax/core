import { defineTable } from "convex/server";
import { v } from "convex/values";

// scanJobId tracks GuardDuty submission for webhook correlation (ADR-012).
// extractionId is the Convex scheduler job ID enabling cancellation/debugging (IN-027).
// fileDeletedAt is set by the 7-year retention cron when it removes the storage object (IN-024).
// fileSizeBytes is client-provided; server MUST verify via ctx.storage.getMetadata() (IN-020).
export const dataImports = defineTable({
  propertyId: v.id("properties"),
  companyId: v.id("companies"),
  originalFilename: v.string(),
  storedFilename: v.string(), // slug-type-date-nanoid4 format
  storageId: v.optional(v.id("_storage")),
  fileSizeBytes: v.number(), // validated: < 50_000_000; verified server-side (IN-020)
  mimeType: v.string(),
  scanStatus: v.union(
    v.literal("pending"),
    v.literal("clean"),
    v.literal("infected"),
    v.literal("scan_failed") // scan_failed → rejected, never proceeds to extraction
  ),
  scanJobId: v.optional(v.string()), // GuardDuty scan job ID; correlates webhook result (ADR-012)
  extractionStatus: v.union(
    v.literal("pending"),
    v.literal("in_progress"),
    v.literal("completed"),
    v.literal("failed"),
    v.literal("timeout")
  ),
  extractionId: v.optional(v.string()), // Convex scheduler job ID from ctx.scheduler.runAfter (IN-027)
  extractedAt: v.optional(v.number()),
  fileDeletedAt: v.optional(v.number()), // set when 7-year retention cron removes the file (IN-024)
  uploadedBy: v.string(), // Better Auth user ID
})
  .index("by_propertyId", ["propertyId"])
  .index("by_extractionStatus", ["propertyId", "extractionStatus"])
  .index("by_scanStatus_creationTime", ["scanStatus"]); // ADR-012: timeout guard cron (_creationTime appended automatically)
