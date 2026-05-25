import { ConvexError, v } from "convex/values";
import { nanoid } from "nanoid";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { mutation } from "../_generated/server";
import { requireUserProfile } from "../lib/withAuth";

// ISO-8601 date string validation (IN-017).
const DATE_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "text/csv": "csv",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

// Validates mime type and file size, checks no extraction is in-flight for this
// property, then returns a signed Convex storage upload URL.
// Lock check + generateUploadUrl happen in a single mutation to eliminate the
// race window described in IN-016.
export const generateUploadUrl = mutation({
  args: {
    propertyId: v.id("properties"),
    fileSizeBytes: v.number(),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireUserProfile(ctx);

    if (profile.role !== "owner" && profile.role !== "gm") {
      throw new ConvexError("Access denied");
    }

    const property = await ctx.db.get(args.propertyId);
    if (!property || property.companyId !== profile.companyId) {
      throw new ConvexError("Property not found");
    }

    if (!ALLOWED_MIME_TYPES.has(args.mimeType)) {
      throw new ConvexError(
        "Unsupported file type. Please upload a PDF, CSV, XLS, or XLSX file."
      );
    }

    if (args.fileSizeBytes >= 50_000_000) {
      throw new ConvexError("File exceeds the 50 MB limit.");
    }

    // IN-016: Check no extraction is currently in-flight for this property.
    const inFlight = await ctx.db
      .query("dataImports")
      .withIndex("by_extractionStatus", (q) =>
        q
          .eq("propertyId", args.propertyId)
          .eq("extractionStatus", "in_progress")
      )
      .first();

    if (inFlight) {
      throw new ConvexError("Extraction in progress, please wait.");
    }

    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { uploadUrl };
  },
});

// Creates the dataImports record and kicks off the malware scan pipeline.
// Server-side file size is verified against the storage metadata (IN-020).
export const recordUpload = mutation({
  args: {
    propertyId: v.id("properties"),
    storageId: v.id("_storage"),
    originalFilename: v.string(),
    fileSizeBytes: v.number(),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    const { profile, userId } = await requireUserProfile(ctx);

    if (profile.role !== "owner" && profile.role !== "gm") {
      throw new ConvexError("Access denied");
    }

    const property = await ctx.db.get(args.propertyId);
    if (!property || property.companyId !== profile.companyId) {
      throw new ConvexError("Property not found");
    }

    if (!profile.companyId) {
      throw new ConvexError("Account setup incomplete");
    }

    // IN-020: Verify file size server-side via storage metadata.
    const metadata = await ctx.storage.getMetadata(args.storageId);
    if (!metadata) {
      throw new ConvexError("Upload not found in storage");
    }
    if (metadata.size !== args.fileSizeBytes) {
      throw new ConvexError("File size mismatch");
    }

    const ext = MIME_TO_EXT[args.mimeType] ?? "bin";
    const storedFilename = `${property.slug}-upload-${Date.now()}-${nanoid(4)}.${ext}`;

    const importId = await ctx.db.insert("dataImports", {
      propertyId: args.propertyId,
      companyId: profile.companyId,
      originalFilename: args.originalFilename,
      storedFilename,
      storageId: args.storageId,
      fileSizeBytes: args.fileSizeBytes,
      mimeType: args.mimeType,
      scanStatus: "pending",
      extractionStatus: "pending",
      uploadedBy: userId,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.uploads.internalActions.runMalwareScan,
      { importId }
    );

    return importId;
  },
});

// ── confirmVerify ──────────────────────────────────────────────────────────────
//
// Records this import's contribution to the audit day for (propertyId, auditDate).
// The auditRecord is found-or-created so multiple uploads can contribute different
// segments to the same day (e.g. rooms report + F&B closing report).
//
// Sub-record write semantics:
//  - roomStatistics : one per audit day — inserted first time, patched on repeat
//                     (last-write-wins; two reports should not both provide rooms)
//  - nonRoomRevenue : additive — each upload appends its revenue lines
//  - paymentRecords : additive — each upload appends its payment lines
//  - paceSnapshots  : additive independent time-series (unchanged)
//
// All sub-records carry importId + sourceType for full provenance.
// Future API/manual sources write directly to sub-record tables with
// sourceType "api"|"manual" and no importId.
//
// Guards:
//  - IN-001: validates each categoryId belongs to this property
//  - IN-012: patches (not replaces) extractorProfiles.mappings
//  - IN-017: ISO-8601 date format validation
export const confirmVerify = mutation({
  args: {
    importId: v.id("dataImports"),
    auditDate: v.string(),
    skipRoomStats: v.optional(v.boolean()),
    resolvedFields: v.object({
      roomsOccupied: v.number(),
      adr: v.number(),
      sameDayCancellations: v.number(),
      noShows: v.number(),
      compRooms: v.number(),
      oooRooms: v.number(),
    }),
    // categoryId null → user chose to skip this line.
    resolvedMappings: v.array(
      v.object({
        sourceLabel: v.string(),
        categoryId: v.union(v.id("revenueCategories"), v.null()),
        amount: v.number(),
      })
    ),
    resolvedPayments: v.array(
      v.object({
        paymentType: v.string(),
        amount: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { profile, userId } = await requireUserProfile(ctx);

    if (profile.role !== "owner" && profile.role !== "gm") {
      throw new ConvexError("Access denied");
    }

    // ── load import + extraction result ────────────────────────────────────────

    const dataImport = await ctx.db.get(args.importId);
    if (!dataImport || dataImport.companyId !== profile.companyId) {
      throw new ConvexError("Import not found");
    }

    const extractionResult = await ctx.db
      .query("extractionResults")
      .withIndex("by_importId", (q) => q.eq("importId", args.importId))
      .first();

    if (!extractionResult || extractionResult.status !== "ready_for_verify") {
      throw new ConvexError("Extraction not ready for verification");
    }

    // ── validate auditDate (IN-017) ────────────────────────────────────────────

    if (!DATE_REGEX.test(args.auditDate)) {
      throw new ConvexError("Invalid date format. Expected YYYY-MM-DD.");
    }

    // ── IN-001: validate each categoryId ──────────────────────────────────────

    await Promise.all(
      args.resolvedMappings.map(async (m) => {
        if (m.categoryId === null) {
          return;
        }
        const cat = await ctx.db.get(m.categoryId as Id<"revenueCategories">);
        if (!cat || cat.propertyId !== dataImport.propertyId) {
          throw new ConvexError(`Invalid revenue category: ${m.categoryId}`);
        }
      })
    );

    // ── load property ──────────────────────────────────────────────────────────

    const property = await ctx.db.get(dataImport.propertyId);
    if (!property) {
      throw new ConvexError("Property not found");
    }

    // ── find-or-create auditRecord for (propertyId, auditDate) ────────────────

    const existingAudit = await ctx.db
      .query("auditRecords")
      .withIndex("by_propertyId_date", (q) =>
        q
          .eq("propertyId", dataImport.propertyId)
          .eq("auditDate", args.auditDate)
      )
      .filter((q) => q.neq(q.field("status"), "overwritten"))
      .first();

    const auditId = existingAudit
      ? existingAudit._id
      : await ctx.db.insert("auditRecords", {
          propertyId: dataImport.propertyId,
          companyId: dataImport.companyId,
          auditDate: args.auditDate,
          source: "upload",
          status: "verified",
          dataImportId: args.importId,
          submittedBy: userId,
          verifiedBy: userId,
          verifiedAt: Date.now(),
        });

    // ── roomStatistics — last-write-wins (omitted when skipRoomStats=true) ────

    if (!args.skipRoomStats) {
      const roomStatsPayload = {
        auditId,
        propertyId: dataImport.propertyId,
        totalRooms: property.totalRooms,
        roomsOccupied: args.resolvedFields.roomsOccupied,
        adr: args.resolvedFields.adr,
        sameDayCancellations: args.resolvedFields.sameDayCancellations,
        noShows: args.resolvedFields.noShows,
        compRooms: args.resolvedFields.compRooms,
        oooRooms: args.resolvedFields.oooRooms,
        importId: args.importId,
        sourceType: "upload" as const,
      };

      const existingRoomStats = await ctx.db
        .query("roomStatistics")
        .withIndex("by_auditId", (q) => q.eq("auditId", auditId))
        .first();

      if (existingRoomStats) {
        await ctx.db.patch(existingRoomStats._id, roomStatsPayload);
      } else {
        await ctx.db.insert("roomStatistics", roomStatsPayload);
      }
    }

    // ── nonRoomRevenue — additive ─────────────────────────────────────────────

    await Promise.all(
      args.resolvedMappings
        .filter((m) => m.categoryId !== null)
        .map((m) =>
          ctx.db.insert("nonRoomRevenue", {
            auditId,
            propertyId: dataImport.propertyId,
            categoryId: m.categoryId as Id<"revenueCategories">,
            amount: m.amount,
            source: m.sourceLabel,
            importId: args.importId,
            sourceType: "upload" as const,
          })
        )
    );

    // ── paymentRecords — additive (find-or-create payment types) ─────────────

    const [propertyPaymentTypes, globalPaymentTypes] = await Promise.all([
      ctx.db
        .query("paymentTypes")
        .withIndex("by_propertyId", (q) =>
          q.eq("propertyId", dataImport.propertyId)
        )
        .filter((q) => q.eq(q.field("archivedAt"), undefined))
        .collect(),
      ctx.db
        .query("paymentTypes")
        .withIndex("by_propertyId", (q) => q.eq("propertyId", undefined))
        .filter((q) => q.eq(q.field("archivedAt"), undefined))
        .collect(),
    ]);

    const paymentTypeByName = new Map<string, Id<"paymentTypes">>(
      [...propertyPaymentTypes, ...globalPaymentTypes].map((pt) => [
        pt.name.toLowerCase(),
        pt._id,
      ])
    );

    const uniqueNames = [
      ...new Set(args.resolvedPayments.map((p) => p.paymentType.toLowerCase())),
    ].filter((n) => !paymentTypeByName.has(n));

    const createdIds = await Promise.all(
      uniqueNames.map(async (lowerName) => {
        const originalName =
          args.resolvedPayments.find(
            (p) => p.paymentType.toLowerCase() === lowerName
          )?.paymentType ?? lowerName;
        const newId = await ctx.db.insert("paymentTypes", {
          propertyId: dataImport.propertyId,
          name: originalName,
          isDefault: false,
        });
        return [lowerName, newId] as const;
      })
    );

    for (const [name, id] of createdIds) {
      paymentTypeByName.set(name, id);
    }

    await Promise.all(
      args.resolvedPayments.map((payment) => {
        const typeId = paymentTypeByName.get(payment.paymentType.toLowerCase());
        if (!typeId) {
          throw new ConvexError(
            `Payment type not resolved: ${payment.paymentType}`
          );
        }
        return ctx.db.insert("paymentRecords", {
          auditId,
          propertyId: dataImport.propertyId,
          paymentTypeId: typeId,
          amount: payment.amount,
          source: "upload",
          importId: args.importId,
          sourceType: "upload" as const,
        });
      })
    );

    // ── paceSnapshots — additive independent time-series ─────────────────────

    await Promise.all(
      extractionResult.paceSnapshot.map((snap) =>
        ctx.db.insert("paceSnapshots", {
          propertyId: dataImport.propertyId,
          snapshotDate: args.auditDate,
          forecastDate: snap.forecastDate,
          roomsOnBooks: snap.roomsOnBooks,
          adr: snap.adr ?? undefined,
          source: "upload",
          dataImportId: args.importId,
        })
      )
    );

    // ── patch extractorProfiles.mappings (IN-012) ─────────────────────────────

    const newMappings = args.resolvedMappings
      .filter((m) => m.categoryId !== null)
      .reduce<Record<string, string>>((acc, m) => {
        acc[m.sourceLabel] = m.categoryId as string;
        return acc;
      }, {});

    if (Object.keys(newMappings).length > 0) {
      const extractorProfile = await ctx.db
        .query("extractorProfiles")
        .withIndex("by_propertyId", (q) =>
          q.eq("propertyId", dataImport.propertyId)
        )
        .first();

      if (extractorProfile) {
        await ctx.db.patch(extractorProfile._id, {
          mappings: { ...extractorProfile.mappings, ...newMappings },
          confirmedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("extractorProfiles", {
          propertyId: dataImport.propertyId,
          mappings: newMappings,
          confirmedAt: Date.now(),
        });
      }
    }

    // ── mark property active on first verified submission ─────────────────────

    if (property.status === "pending_first_upload") {
      await ctx.db.patch(dataImport.propertyId, { status: "active" });
    }

    // ── mark extraction result as verified ────────────────────────────────────

    await ctx.db.patch(extractionResult._id, { status: "verified" });

    return auditId;
  },
});
