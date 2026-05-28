import { ConvexError, v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { type MutationCtx, mutation } from "../_generated/server";

const SOURCE = "legacy";
const MAX_BUCKET_ENTRIES = 8192;

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "legacy-property";

const sourceRefFor = async (
  ctx: MutationCtx,
  sourceTable: string,
  legacyId: number,
  targetTable: string
) => {
  const refs = await ctx.db
    .query("sourceRefs")
    .withIndex("by_source_table_legacy", (q) =>
      q
        .eq("source", SOURCE)
        .eq("sourceTable", sourceTable)
        .eq("legacyId", legacyId)
    )
    .collect();

  return refs.find((ref) => ref.targetTable === targetTable) ?? null;
};

export const upsertLegacyProperties = mutation({
  args: {
    companies: v.array(
      v.object({
        legacyCompanyId: v.number(),
        name: v.string(),
        totalRooms: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const results: Array<{
      companyId: Id<"companies">;
      legacyCompanyId: number;
      propertyId: Id<"properties">;
    }> = [];

    for (const company of args.companies) {
      const existingCompanyRef = await sourceRefFor(
        ctx,
        "legacyCompanies",
        company.legacyCompanyId,
        "companies"
      );
      const existingPropertyRef = await sourceRefFor(
        ctx,
        "legacyCompanies",
        company.legacyCompanyId,
        "properties"
      );

      let companyId = existingCompanyRef?.targetId as
        | Id<"companies">
        | undefined;
      let propertyId = existingPropertyRef?.targetId as
        | Id<"properties">
        | undefined;

      if (companyId) {
        await ctx.db.patch(companyId, { name: company.name });
      } else {
        companyId = await ctx.db.insert("companies", { name: company.name });
        await ctx.db.insert("sourceRefs", {
          source: SOURCE,
          sourceTable: "legacyCompanies",
          legacyId: company.legacyCompanyId,
          targetTable: "companies",
          targetId: companyId,
        });
      }

      if (propertyId) {
        await ctx.db.patch(propertyId, {
          companyId,
          name: company.name,
          totalRooms: company.totalRooms,
        });
      } else {
        propertyId = await ctx.db.insert("properties", {
          companyId,
          name: company.name,
          slug: slugify(company.name),
          totalRooms: company.totalRooms,
          timezone: "UTC",
          status: "active",
          varianceThresholdPct: 10,
          varianceConsecutiveDays: 3,
          paceYellowThresholdPct: 10,
          paceRedThresholdPct: 10,
          pickupVelocityThresholdPct: 50,
        });
        await ctx.db.insert("sourceRefs", {
          source: SOURCE,
          sourceTable: "legacyCompanies",
          legacyId: company.legacyCompanyId,
          targetTable: "properties",
          targetId: propertyId,
        });
      }

      results.push({
        companyId,
        legacyCompanyId: company.legacyCompanyId,
        propertyId,
      });
    }

    return results;
  },
});

export const upsertPaceSnapshotDays = mutation({
  args: {
    buckets: v.array(
      v.object({
        legacyAuditId: v.number(),
        legacyCompanyId: v.number(),
        snapshotDate: v.string(),
        entries: v.array(
          v.object({
            forDate: v.string(),
            roomsOnBooks: v.number(),
            adr: v.optional(v.number()),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    let upserted = 0;

    for (const bucket of args.buckets) {
      if (bucket.entries.length > MAX_BUCKET_ENTRIES) {
        throw new ConvexError(
          `Pace bucket ${bucket.legacyAuditId} has ${bucket.entries.length} entries; max is ${MAX_BUCKET_ENTRIES}.`
        );
      }

      const propertyRef = await sourceRefFor(
        ctx,
        "legacyCompanies",
        bucket.legacyCompanyId,
        "properties"
      );
      const companyRef = await sourceRefFor(
        ctx,
        "legacyCompanies",
        bucket.legacyCompanyId,
        "companies"
      );

      if (!(propertyRef && companyRef)) {
        throw new ConvexError(
          `Legacy company ${bucket.legacyCompanyId} has not been canonicalized.`
        );
      }

      const existing = await ctx.db
        .query("paceSnapshotDays")
        .withIndex("by_legacyAuditId", (q) =>
          q.eq("legacyAuditId", bucket.legacyAuditId)
        )
        .first();

      const payload = {
        propertyId: propertyRef.targetId as Id<"properties">,
        companyId: companyRef.targetId as Id<"companies">,
        snapshotDate: bucket.snapshotDate,
        source: SOURCE,
        legacyAuditId: bucket.legacyAuditId,
        entries: bucket.entries,
      };

      if (existing) {
        await ctx.db.patch(existing._id, payload);
      } else {
        await ctx.db.insert("paceSnapshotDays", payload);
      }

      upserted += 1;
    }

    return { upserted };
  },
});

export const upsertLegacyAuditSnapshots = mutation({
  args: {
    snapshots: v.array(
      v.object({
        legacyAuditId: v.number(),
        legacyCompanyId: v.number(),
        auditDate: v.string(),
        snapshot: v.any(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let upserted = 0;

    for (const snapshot of args.snapshots) {
      const existing = await ctx.db
        .query("legacyAuditSnapshots")
        .withIndex("by_legacyAuditId", (q) =>
          q.eq("legacyAuditId", snapshot.legacyAuditId)
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, snapshot);
      } else {
        await ctx.db.insert("legacyAuditSnapshots", snapshot);
      }

      upserted += 1;
    }

    return { upserted };
  },
});
