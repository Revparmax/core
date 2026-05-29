import { ConvexError, v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { type MutationCtx, mutation } from "../_generated/server";

const SOURCE = "legacy";
const MAX_BUCKET_ENTRIES = 8192;
const LEGACY_ARCHIVED_AT = 0;

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

const upsertSourceRef = async (
  ctx: MutationCtx,
  sourceTable: string,
  legacyId: number,
  targetTable: string,
  targetId: string
) => {
  const existing = await sourceRefFor(ctx, sourceTable, legacyId, targetTable);

  if (existing) {
    await ctx.db.patch(existing._id, { targetId });
    return;
  }

  await ctx.db.insert("sourceRefs", {
    source: SOURCE,
    sourceTable,
    legacyId,
    targetTable,
    targetId,
  });
};

const canonicalRefsForLegacyCompany = async (
  ctx: MutationCtx,
  legacyCompanyId: number
) => {
  const companyRef = await sourceRefFor(
    ctx,
    "legacyCompanies",
    legacyCompanyId,
    "companies"
  );
  const propertyRef = await sourceRefFor(
    ctx,
    "legacyCompanies",
    legacyCompanyId,
    "properties"
  );

  if (!(companyRef && propertyRef)) {
    throw new ConvexError(
      `Legacy company ${legacyCompanyId} has not been canonicalized.`
    );
  }

  return {
    companyId: companyRef.targetId as Id<"companies">,
    propertyId: propertyRef.targetId as Id<"properties">,
  };
};

const legacyCompanyScopedTable = (
  sourceTable: string,
  legacyCompanyId: number
): string => `${sourceTable}:${legacyCompanyId}`;

const targetIdFor = async <TableName extends string>(
  ctx: MutationCtx,
  sourceTable: string,
  legacyId: number,
  targetTable: TableName
): Promise<string | null> => {
  const ref = await sourceRefFor(ctx, sourceTable, legacyId, targetTable);
  return ref?.targetId ?? null;
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

export const upsertLegacyRevenueCategories = mutation({
  args: {
    legacyCompanyId: v.number(),
    parents: v.array(
      v.object({
        displayOrder: v.number(),
        legacyRevenueCategoryId: v.number(),
        name: v.string(),
      })
    ),
    categories: v.array(
      v.object({
        displayOrder: v.number(),
        legacyParentRevenueCategoryId: v.optional(v.number()),
        legacyRevenueCategoryId: v.number(),
        name: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { companyId, propertyId } = await canonicalRefsForLegacyCompany(
      ctx,
      args.legacyCompanyId
    );
    const sourceTable = legacyCompanyScopedTable(
      "legacyRevenueCategories",
      args.legacyCompanyId
    );
    const parentIdByLegacyId = new Map<number, Id<"revenueParentCategories">>();
    let upsertedParents = 0;
    let upsertedCategories = 0;

    for (const parent of args.parents) {
      const existingId = await targetIdFor(
        ctx,
        sourceTable,
        parent.legacyRevenueCategoryId,
        "revenueParentCategories"
      );
      const payload = {
        propertyId,
        companyId,
        name: parent.name,
        displayOrder: parent.displayOrder,
      };
      const parentId = existingId
        ? (existingId as Id<"revenueParentCategories">)
        : await ctx.db.insert("revenueParentCategories", payload);

      if (existingId) {
        await ctx.db.patch(parentId, payload);
      } else {
        await upsertSourceRef(
          ctx,
          sourceTable,
          parent.legacyRevenueCategoryId,
          "revenueParentCategories",
          parentId
        );
      }

      parentIdByLegacyId.set(parent.legacyRevenueCategoryId, parentId);
      upsertedParents += 1;
    }

    for (const category of args.categories) {
      const existingId = await targetIdFor(
        ctx,
        sourceTable,
        category.legacyRevenueCategoryId,
        "revenueCategories"
      );
      const parentId =
        category.legacyParentRevenueCategoryId === undefined
          ? undefined
          : parentIdByLegacyId.get(category.legacyParentRevenueCategoryId);
      const payload = {
        propertyId,
        companyId,
        ...(parentId === undefined ? {} : { parentId }),
        name: category.name,
        displayOrder: category.displayOrder,
      };
      const categoryId = existingId
        ? (existingId as Id<"revenueCategories">)
        : await ctx.db.insert("revenueCategories", payload);

      if (existingId) {
        await ctx.db.patch(categoryId, payload);
      } else {
        await upsertSourceRef(
          ctx,
          sourceTable,
          category.legacyRevenueCategoryId,
          "revenueCategories",
          categoryId
        );
      }

      upsertedCategories += 1;
    }

    return { upsertedParents, upsertedCategories };
  },
});

export const upsertLegacyPaymentTypes = mutation({
  args: {
    legacyCompanyId: v.number(),
    paymentTypes: v.array(
      v.object({
        legacyPaymentTypeId: v.number(),
        name: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { propertyId } = await canonicalRefsForLegacyCompany(
      ctx,
      args.legacyCompanyId
    );
    const sourceTable = legacyCompanyScopedTable(
      "legacyPaymentTypes",
      args.legacyCompanyId
    );
    let upserted = 0;

    for (const paymentType of args.paymentTypes) {
      const existingId = await targetIdFor(
        ctx,
        sourceTable,
        paymentType.legacyPaymentTypeId,
        "paymentTypes"
      );
      const payload = {
        propertyId,
        name: paymentType.name,
        isDefault: false,
      };
      const paymentTypeId = existingId
        ? (existingId as Id<"paymentTypes">)
        : await ctx.db.insert("paymentTypes", payload);

      if (existingId) {
        await ctx.db.patch(paymentTypeId, payload);
      } else {
        await upsertSourceRef(
          ctx,
          sourceTable,
          paymentType.legacyPaymentTypeId,
          "paymentTypes",
          paymentTypeId
        );
      }

      upserted += 1;
    }

    return { upserted };
  },
});

export const upsertLegacyAudits = mutation({
  args: {
    audits: v.array(
      v.object({
        auditDate: v.string(),
        legacyAuditId: v.number(),
        legacyCompanyId: v.number(),
        submittedBy: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let upserted = 0;

    for (const audit of args.audits) {
      const { companyId, propertyId } = await canonicalRefsForLegacyCompany(
        ctx,
        audit.legacyCompanyId
      );
      const existingId = await targetIdFor(
        ctx,
        "legacyAudits",
        audit.legacyAuditId,
        "auditRecords"
      );
      const payload = {
        propertyId,
        companyId,
        auditDate: audit.auditDate,
        source: "manual" as const,
        status: "verified" as const,
        submittedBy: audit.submittedBy,
        verifiedBy: audit.submittedBy,
        verifiedAt: LEGACY_ARCHIVED_AT,
      };
      const auditId = existingId
        ? (existingId as Id<"auditRecords">)
        : await ctx.db.insert("auditRecords", payload);

      if (existingId) {
        await ctx.db.patch(auditId, payload);
      } else {
        await upsertSourceRef(
          ctx,
          "legacyAudits",
          audit.legacyAuditId,
          "auditRecords",
          auditId
        );
      }

      upserted += 1;
    }

    return { upserted };
  },
});

export const upsertLegacyRoomStatistics = mutation({
  args: {
    rows: v.array(
      v.object({
        adr: v.number(),
        compRooms: v.number(),
        legacyAuditId: v.number(),
        noShows: v.number(),
        oooRooms: v.number(),
        roomsOccupied: v.number(),
        sameDayCancellations: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let upserted = 0;

    for (const row of args.rows) {
      const auditId = (await targetIdFor(
        ctx,
        "legacyAudits",
        row.legacyAuditId,
        "auditRecords"
      )) as Id<"auditRecords"> | null;
      if (!auditId) {
        continue;
      }

      const audit = await ctx.db.get(auditId);
      const property = audit ? await ctx.db.get(audit.propertyId) : null;
      if (!(audit && property)) {
        continue;
      }

      const existingId = await targetIdFor(
        ctx,
        "legacyRoomStatsByAudit",
        row.legacyAuditId,
        "roomStatistics"
      );
      const payload = {
        auditId,
        propertyId: audit.propertyId,
        totalRooms: property.totalRooms,
        roomsOccupied: row.roomsOccupied,
        adr: row.adr,
        sameDayCancellations: row.sameDayCancellations,
        noShows: row.noShows,
        compRooms: row.compRooms,
        oooRooms: row.oooRooms,
        sourceType: "manual" as const,
      };
      const roomStatisticsId = existingId
        ? (existingId as Id<"roomStatistics">)
        : await ctx.db.insert("roomStatistics", payload);

      if (existingId) {
        await ctx.db.patch(roomStatisticsId, payload);
      } else {
        await upsertSourceRef(
          ctx,
          "legacyRoomStatsByAudit",
          row.legacyAuditId,
          "roomStatistics",
          roomStatisticsId
        );
      }

      upserted += 1;
    }

    return { upserted };
  },
});

export const upsertLegacyNonRoomRevenue = mutation({
  args: {
    rows: v.array(
      v.object({
        amount: v.number(),
        legacyAuditId: v.number(),
        legacyCompanyId: v.number(),
        legacyRevenueCategoryId: v.number(),
        legacyRevenueStatId: v.number(),
        source: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let skipped = 0;
    let upserted = 0;

    for (const row of args.rows) {
      const auditId = (await targetIdFor(
        ctx,
        "legacyAudits",
        row.legacyAuditId,
        "auditRecords"
      )) as Id<"auditRecords"> | null;
      const categoryId = (await targetIdFor(
        ctx,
        legacyCompanyScopedTable(
          "legacyRevenueCategories",
          row.legacyCompanyId
        ),
        row.legacyRevenueCategoryId,
        "revenueCategories"
      )) as Id<"revenueCategories"> | null;
      const audit = auditId ? await ctx.db.get(auditId) : null;

      if (!(audit && categoryId)) {
        skipped += 1;
        continue;
      }

      const existingId = await targetIdFor(
        ctx,
        "legacyRevenueStats",
        row.legacyRevenueStatId,
        "nonRoomRevenue"
      );
      const payload = {
        auditId: audit._id,
        propertyId: audit.propertyId,
        categoryId,
        amount: row.amount,
        source: row.source,
        sourceType: "manual" as const,
      };
      const revenueId = existingId
        ? (existingId as Id<"nonRoomRevenue">)
        : await ctx.db.insert("nonRoomRevenue", payload);

      if (existingId) {
        await ctx.db.patch(revenueId, payload);
      } else {
        await upsertSourceRef(
          ctx,
          "legacyRevenueStats",
          row.legacyRevenueStatId,
          "nonRoomRevenue",
          revenueId
        );
      }

      upserted += 1;
    }

    return { skipped, upserted };
  },
});

export const upsertLegacyPaymentRecords = mutation({
  args: {
    rows: v.array(
      v.object({
        amount: v.number(),
        legacyAuditId: v.number(),
        legacyCompanyId: v.number(),
        legacyPaymentTypeId: v.number(),
        legacyPaymentTypeStatId: v.number(),
        source: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let skipped = 0;
    let upserted = 0;

    for (const row of args.rows) {
      const auditId = (await targetIdFor(
        ctx,
        "legacyAudits",
        row.legacyAuditId,
        "auditRecords"
      )) as Id<"auditRecords"> | null;
      const paymentTypeId = (await targetIdFor(
        ctx,
        legacyCompanyScopedTable("legacyPaymentTypes", row.legacyCompanyId),
        row.legacyPaymentTypeId,
        "paymentTypes"
      )) as Id<"paymentTypes"> | null;
      const audit = auditId ? await ctx.db.get(auditId) : null;

      if (!(audit && paymentTypeId)) {
        skipped += 1;
        continue;
      }

      const existingId = await targetIdFor(
        ctx,
        "legacyPaymentTypeStats",
        row.legacyPaymentTypeStatId,
        "paymentRecords"
      );
      const payload = {
        auditId: audit._id,
        propertyId: audit.propertyId,
        paymentTypeId,
        amount: row.amount,
        source: row.source,
        sourceType: "manual" as const,
      };
      const paymentRecordId = existingId
        ? (existingId as Id<"paymentRecords">)
        : await ctx.db.insert("paymentRecords", payload);

      if (existingId) {
        await ctx.db.patch(paymentRecordId, payload);
      } else {
        await upsertSourceRef(
          ctx,
          "legacyPaymentTypeStats",
          row.legacyPaymentTypeStatId,
          "paymentRecords",
          paymentRecordId
        );
      }

      upserted += 1;
    }

    return { skipped, upserted };
  },
});

export const upsertLegacyCompetitors = mutation({
  args: {
    legacyCompanyId: v.number(),
    competitors: v.array(
      v.object({
        enabled: v.boolean(),
        legacyCompetitionId: v.number(),
        name: v.string(),
        totalRooms: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { propertyId } = await canonicalRefsForLegacyCompany(
      ctx,
      args.legacyCompanyId
    );
    let upserted = 0;

    for (const competitor of args.competitors) {
      const existingId = await targetIdFor(
        ctx,
        "legacyCompetitions",
        competitor.legacyCompetitionId,
        "competitors"
      );
      const payload = {
        propertyId,
        name: competitor.name,
        ...(competitor.totalRooms === undefined
          ? {}
          : { totalRooms: competitor.totalRooms }),
        ...(competitor.enabled ? {} : { archivedAt: LEGACY_ARCHIVED_AT }),
      };
      const competitorId = existingId
        ? (existingId as Id<"competitors">)
        : await ctx.db.insert("competitors", payload);

      if (existingId) {
        await ctx.db.patch(competitorId, payload);
      } else {
        await upsertSourceRef(
          ctx,
          "legacyCompetitions",
          competitor.legacyCompetitionId,
          "competitors",
          competitorId
        );
      }

      upserted += 1;
    }

    return { upserted };
  },
});

export const upsertLegacyCompetitionData = mutation({
  args: {
    rows: v.array(
      v.object({
        capturedAt: v.number(),
        dailyOccupancy: v.optional(v.number()),
        legacyAuditId: v.number(),
        legacyCompetitionId: v.number(),
        legacyCompetitionStatId: v.number(),
        rate: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let skipped = 0;
    let upserted = 0;

    for (const row of args.rows) {
      const auditId = (await targetIdFor(
        ctx,
        "legacyAudits",
        row.legacyAuditId,
        "auditRecords"
      )) as Id<"auditRecords"> | null;
      const competitorId = (await targetIdFor(
        ctx,
        "legacyCompetitions",
        row.legacyCompetitionId,
        "competitors"
      )) as Id<"competitors"> | null;
      const audit = auditId ? await ctx.db.get(auditId) : null;

      if (!(audit && competitorId)) {
        skipped += 1;
        continue;
      }

      const existingId = await targetIdFor(
        ctx,
        "legacyCompetitionStats",
        row.legacyCompetitionStatId,
        "competitionData"
      );
      const payload = {
        propertyId: audit.propertyId,
        competitorId,
        capturedAt: row.capturedAt,
        ...(row.rate === undefined ? {} : { rate: row.rate }),
        ...(row.dailyOccupancy === undefined
          ? {}
          : { dailyOccupancy: row.dailyOccupancy }),
        sourceType: "manual" as const,
        auditId: audit._id,
      };
      const competitionDataId = existingId
        ? (existingId as Id<"competitionData">)
        : await ctx.db.insert("competitionData", payload);

      if (existingId) {
        await ctx.db.patch(competitionDataId, payload);
      } else {
        await upsertSourceRef(
          ctx,
          "legacyCompetitionStats",
          row.legacyCompetitionStatId,
          "competitionData",
          competitionDataId
        );
      }

      upserted += 1;
    }

    return { skipped, upserted };
  },
});

export const upsertLegacyBudgets = mutation({
  args: {
    revenueBudgets: v.array(
      v.object({
        amount: v.number(),
        fiscalYear: v.number(),
        legacyBudgetRevenueId: v.number(),
        legacyCompanyId: v.number(),
        legacyRevenueCategoryId: v.number(),
        month: v.number(),
      })
    ),
    roomBudgets: v.array(
      v.object({
        budgetAdr: v.number(),
        budgetOccupancy: v.number(),
        fiscalYear: v.number(),
        legacyBudgetRoomId: v.number(),
        legacyCompanyId: v.number(),
        month: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let skipped = 0;
    let upserted = 0;

    for (const row of args.roomBudgets) {
      const { companyId, propertyId } = await canonicalRefsForLegacyCompany(
        ctx,
        row.legacyCompanyId
      );
      const existingId = await targetIdFor(
        ctx,
        "legacyBudgetRooms",
        row.legacyBudgetRoomId,
        "budgets"
      );
      const payload = {
        propertyId,
        companyId,
        fiscalYear: row.fiscalYear,
        month: row.month,
        budgetOccupancy: row.budgetOccupancy,
        budgetAdr: row.budgetAdr,
        isOriginal: true,
      };
      const budgetId = existingId
        ? (existingId as Id<"budgets">)
        : await ctx.db.insert("budgets", payload);

      if (existingId) {
        await ctx.db.patch(budgetId, payload);
      } else {
        await upsertSourceRef(
          ctx,
          "legacyBudgetRooms",
          row.legacyBudgetRoomId,
          "budgets",
          budgetId
        );
      }

      upserted += 1;
    }

    for (const row of args.revenueBudgets) {
      const { companyId, propertyId } = await canonicalRefsForLegacyCompany(
        ctx,
        row.legacyCompanyId
      );
      const categoryId = (await targetIdFor(
        ctx,
        legacyCompanyScopedTable(
          "legacyRevenueCategories",
          row.legacyCompanyId
        ),
        row.legacyRevenueCategoryId,
        "revenueCategories"
      )) as Id<"revenueCategories"> | null;

      if (!categoryId) {
        skipped += 1;
        continue;
      }

      const existingId = await targetIdFor(
        ctx,
        "legacyBudgetRevenues",
        row.legacyBudgetRevenueId,
        "budgets"
      );
      const payload = {
        propertyId,
        companyId,
        fiscalYear: row.fiscalYear,
        month: row.month,
        categoryId,
        budgetAmount: row.amount,
        isOriginal: true,
      };
      const budgetId = existingId
        ? (existingId as Id<"budgets">)
        : await ctx.db.insert("budgets", payload);

      if (existingId) {
        await ctx.db.patch(budgetId, payload);
      } else {
        await upsertSourceRef(
          ctx,
          "legacyBudgetRevenues",
          row.legacyBudgetRevenueId,
          "budgets",
          budgetId
        );
      }

      upserted += 1;
    }

    return { skipped, upserted };
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
