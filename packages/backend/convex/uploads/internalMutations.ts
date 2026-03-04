import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";

// Updates scanStatus after malware scan completes.
// On clean: schedules extraction.
// On infected/scan_failed: deletes the stored file (ADR-012 / IN-006).
export const markScanResult = internalMutation({
  args: {
    importId: v.id("dataImports"),
    result: v.union(
      v.literal("clean"),
      v.literal("infected"),
      v.literal("scan_failed")
    ),
  },
  handler: async (ctx, args) => {
    const dataImport = await ctx.db.get(args.importId);
    if (!dataImport) {
      return;
    }

    if (args.result === "clean") {
      await ctx.db.patch(args.importId, {
        scanStatus: "clean",
        extractionStatus: "pending",
      });

      await ctx.scheduler.runAfter(
        0,
        internal.uploads.internalActions.runExtraction,
        { importId: args.importId }
      );
    } else {
      // Delete the stored file so infected/failed uploads don't persist.
      if (dataImport.storageId) {
        await ctx.storage.delete(dataImport.storageId);
      }

      await ctx.db.patch(args.importId, {
        scanStatus: args.result,
        storageId: undefined,
      });
    }
  },
});

// Marks extraction as in_progress when the action starts processing.
export const setExtractionInProgress = internalMutation({
  args: { importId: v.id("dataImports") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.importId, { extractionStatus: "in_progress" });
  },
});

// Writes the extractionResults document and updates dataImports.extractionStatus.
export const markExtractionResult = internalMutation({
  args: {
    importId: v.id("dataImports"),
    status: v.union(
      v.literal("ready_for_verify"),
      v.literal("failed"),
      v.literal("timeout")
    ),
    auditDate: v.optional(v.string()),
    reportType: v.optional(v.string()),
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
  },
  handler: async (ctx, args) => {
    const dataImport = await ctx.db.get(args.importId);
    if (!dataImport) {
      return;
    }

    const convexStatus =
      args.status === "ready_for_verify" ? "completed" : args.status;

    await ctx.db.patch(args.importId, {
      extractionStatus: convexStatus,
      extractedAt: Date.now(),
    });

    // Persisted 24hr for verify-flow resume after browser close (ADR-006).
    await ctx.db.insert("extractionResults", {
      importId: args.importId,
      propertyId: dataImport.propertyId,
      status: args.status,
      extractedFields: args.extractedFields,
      proposedMappings: args.proposedMappings,
      payments: args.payments,
      paceSnapshot: args.paceSnapshot,
      auditDate: args.auditDate,
      reportType: args.reportType,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });
  },
});
