import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { type QueryCtx, query } from "../_generated/server";
import {
  addDays,
  assertIsoDate,
  datesInRange,
  daysBetween,
  monthRange,
  sameWeekdayLastYear,
} from "./dateMath";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

type PaceEntry = Doc<"paceSnapshotDays">["entries"][number];
type ForecastColorStatus = "green" | "red" | "unavailable" | "yellow";

interface ForecastRowContext {
  budgetAdr: number | null;
  budgetOccupancy: number | null;
  lyFinalEntries: Map<string, PaceEntry>;
  lyMonthStartEntries: Map<string, PaceEntry>;
  lyPaceBuckets: Map<string, Doc<"paceSnapshotDays"> | null>;
  property: Doc<"properties">;
  tyEntries: Map<string, PaceEntry>;
  tyMonthStartEntries: Map<string, PaceEntry>;
}

interface ActualMetrics {
  revenue: number | null;
  rooms: number | null;
}

interface AuditDetailPaces {
  items: PaceEntry[];
  legacyAuditId?: number;
  nextCursor: string | null;
  snapshotDate?: string;
  warnings: string[];
}

const clampLimit = (limit: number | undefined): number => {
  if (limit === undefined) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
};

const cursorOffset = (cursor: string | undefined): number => {
  if (!cursor) {
    return 0;
  }
  const offset = Number(cursor);
  return Number.isInteger(offset) && offset >= 0 ? offset : 0;
};

const paginate = <T>(
  rows: T[],
  limitArg: number | undefined,
  cursor: string | undefined
): { items: T[]; nextCursor: string | null } => {
  const limit = clampLimit(limitArg);
  const offset = cursorOffset(cursor);
  const items = rows.slice(offset, offset + limit);
  const nextOffset = offset + items.length;
  return {
    items,
    nextCursor: nextOffset < rows.length ? String(nextOffset) : null,
  };
};

const sourceRefForLegacyCompany = async (
  ctx: QueryCtx,
  legacyCompanyId: number,
  targetTable: "companies" | "properties"
) => {
  const refs = await ctx.db
    .query("sourceRefs")
    .withIndex("by_source_table_legacy", (q) =>
      q
        .eq("source", "legacy")
        .eq("sourceTable", "legacyCompanies")
        .eq("legacyId", legacyCompanyId)
    )
    .collect();

  return refs.find((ref) => ref.targetTable === targetTable) ?? null;
};

const sourceRefForTarget = async (
  ctx: QueryCtx,
  targetTable: string,
  targetId: string
) => {
  const refs = await ctx.db
    .query("sourceRefs")
    .withIndex("by_target", (q) =>
      q.eq("targetTable", targetTable).eq("targetId", targetId)
    )
    .collect();

  return refs.find((candidate) => candidate.source === "legacy") ?? null;
};

const legacyCompanyIdForProperty = async (
  ctx: QueryCtx,
  propertyId: Id<"properties">
): Promise<number> => {
  const ref = await sourceRefForTarget(ctx, "properties", propertyId);

  if (!ref) {
    throw new ConvexError("Property is not mapped to a legacy company");
  }

  return ref.legacyId;
};

const canonicalCompanyName = async (
  ctx: QueryCtx,
  legacyCompanyId: number
): Promise<string | null> => {
  const companyRef = await sourceRefForLegacyCompany(
    ctx,
    legacyCompanyId,
    "companies"
  );
  const company = companyRef
    ? await ctx.db.get(companyRef.targetId as Id<"companies">)
    : null;

  return company?.name ?? null;
};

const canonicalCompanyView = async (ctx: QueryCtx, legacyCompanyId: number) => {
  const [companyRef, propertyRef] = await Promise.all([
    sourceRefForLegacyCompany(ctx, legacyCompanyId, "companies"),
    sourceRefForLegacyCompany(ctx, legacyCompanyId, "properties"),
  ]);
  const [company, property] = await Promise.all([
    companyRef ? ctx.db.get(companyRef.targetId as Id<"companies">) : null,
    propertyRef ? ctx.db.get(propertyRef.targetId as Id<"properties">) : null,
  ]);

  if (!company) {
    return null;
  }

  return {
    legacyCompanyId,
    companyId: company._id,
    propertyId: property?._id ?? null,
    name: company.name,
    owner: null,
    parentLegacyCompanyId: null,
    totalRooms: property?.totalRooms ?? null,
    status: property?.status ?? null,
  };
};

const entryMapFor = (entries: PaceEntry[]): Map<string, PaceEntry> =>
  new Map(entries.map((entry) => [entry.forDate, entry]));

const getPaceBucket = async (
  ctx: QueryCtx,
  propertyId: Id<"properties">,
  snapshotDate: string
) =>
  await ctx.db
    .query("paceSnapshotDays")
    .withIndex("by_property_snapshot", (q) =>
      q.eq("propertyId", propertyId).eq("snapshotDate", snapshotDate)
    )
    .first();

const sameDayPaceEntriesByDate = async (
  ctx: QueryCtx,
  propertyId: Id<"properties">,
  dates: string[]
): Promise<Map<string, PaceEntry>> => {
  const entriesByDate = new Map<string, PaceEntry>();

  for (const date of dates) {
    const bucket = await getPaceBucket(ctx, propertyId, date);
    const entry = bucket?.entries.find(
      (candidate) => candidate.forDate === date
    );
    if (entry !== undefined) {
      entriesByDate.set(date, entry);
    }
  }

  return entriesByDate;
};

const auditPacesPreview = async (
  ctx: QueryCtx,
  legacyAuditId: number
): Promise<AuditDetailPaces> => {
  const bucket = await ctx.db
    .query("paceSnapshotDays")
    .withIndex("by_legacyAuditId", (q) => q.eq("legacyAuditId", legacyAuditId))
    .first();

  if (!bucket) {
    return {
      items: [],
      nextCursor: null,
      warnings: [
        "No canonical pace bucket found for this audit. Raw legacyPaces is intentionally not scanned by audit detail.",
      ],
    };
  }

  const paged = paginate(bucket.entries, 25, undefined);
  return {
    items: paged.items,
    nextCursor: paged.nextCursor,
    snapshotDate: bucket.snapshotDate,
    legacyAuditId: bucket.legacyAuditId,
    warnings: [
      "Paces are a limited preview from canonical daily pace buckets. Use getAuditPaces for pagination.",
    ],
  };
};

const auditRecordForLegacyAudit = async (
  ctx: QueryCtx,
  legacyAuditId: number
) => {
  const ref = await ctx.db
    .query("sourceRefs")
    .withIndex("by_source_table_legacy", (q) =>
      q
        .eq("source", "legacy")
        .eq("sourceTable", "legacyAudits")
        .eq("legacyId", legacyAuditId)
    )
    .first();

  if (!ref || ref.targetTable !== "auditRecords") {
    return null;
  }

  const audit = await ctx.db.get(ref.targetId as Id<"auditRecords">);
  return audit ? { audit, legacyAuditId } : null;
};

const canonicalAuditDetail = async (ctx: QueryCtx, legacyAuditId: number) => {
  const auditRef = await auditRecordForLegacyAudit(ctx, legacyAuditId);
  if (!auditRef) {
    return null;
  }

  const { audit } = auditRef;
  const [company, roomStats, revenueStats, paymentStats, competitionStats] =
    await Promise.all([
      ctx.db.get(audit.companyId),
      ctx.db
        .query("roomStatistics")
        .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
        .first(),
      ctx.db
        .query("nonRoomRevenue")
        .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
        .collect(),
      ctx.db
        .query("paymentRecords")
        .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
        .collect(),
      ctx.db
        .query("competitionData")
        .withIndex("by_auditId", (q) => q.eq("auditId", audit._id))
        .collect(),
    ]);
  const legacyCompanyRef = await sourceRefForTarget(
    ctx,
    "companies",
    audit.companyId
  );

  return {
    audit: {
      legacyAuditId,
      legacyCompanyId: legacyCompanyRef?.legacyId ?? null,
      companyName: company?.name ?? null,
      date: audit.auditDate,
      preparedBy: audit.submittedBy,
      comments: null,
      source: "canonical_tables",
    },
    roomStats: roomStats
      ? [
          { roomCategory: "Rooms Occupied", amount: roomStats.roomsOccupied },
          { roomCategory: "ADR $", amount: roomStats.adr },
          {
            roomCategory: "Same Day Cancellations",
            amount: roomStats.sameDayCancellations,
          },
          { roomCategory: "No Shows", amount: roomStats.noShows },
          { roomCategory: "Comp Rooms", amount: roomStats.compRooms },
          { roomCategory: "Out of Order Rooms", amount: roomStats.oooRooms },
        ]
      : [],
    revenueStats: await Promise.all(
      revenueStats.map(async (record) => {
        const [category, ref] = await Promise.all([
          ctx.db.get(record.categoryId),
          sourceRefForTarget(ctx, "nonRoomRevenue", record._id),
        ]);
        const parent = category?.parentId
          ? await ctx.db.get(category.parentId)
          : null;
        return {
          legacyRevenueStatId: ref?.legacyId ?? null,
          legacyRevenueCategoryId: null,
          revenueCategory: category?.name ?? record.source,
          parentCategory: parent?.name ?? null,
          amount: record.amount,
        };
      })
    ),
    paymentTypeStats: await Promise.all(
      paymentStats.map(async (record) => {
        const [paymentType, ref] = await Promise.all([
          ctx.db.get(record.paymentTypeId),
          sourceRefForTarget(ctx, "paymentRecords", record._id),
        ]);
        return {
          legacyPaymentTypeStatId: ref?.legacyId ?? null,
          legacyPaymentTypeId: null,
          paymentType: paymentType?.name ?? record.source,
          amount: record.amount,
        };
      })
    ),
    competitionStats: await Promise.all(
      competitionStats.map(async (record) => {
        const [competitor, ref] = await Promise.all([
          ctx.db.get(record.competitorId),
          sourceRefForTarget(ctx, "competitionData", record._id),
        ]);
        return {
          legacyCompetitionStatId: ref?.legacyId ?? null,
          legacyCompetitionId: null,
          competitor: competitor?.name ?? null,
          totalRooms: competitor?.totalRooms ?? null,
          enabled: competitor?.archivedAt === undefined,
          extcodes: [],
          rate: record.rate ?? null,
          occupiedRooms:
            record.dailyOccupancy !== undefined && competitor?.totalRooms
              ? record.dailyOccupancy * competitor.totalRooms
              : null,
        };
      })
    ),
    files: [],
    receivedAuditDataTypes: [],
    paces: await auditPacesPreview(ctx, legacyAuditId),
    warnings: [
      "files and receivedAuditDataTypes have not been projected into canonical tables yet.",
    ],
  };
};

const paceActualMetricsByDate = async (
  ctx: QueryCtx,
  propertyId: Id<"properties">,
  dates: string[]
): Promise<Map<string, ActualMetrics>> => {
  const entriesByDate = await sameDayPaceEntriesByDate(ctx, propertyId, dates);
  const metricsByDate = new Map<string, ActualMetrics>();

  for (const date of dates) {
    const entry = entriesByDate.get(date);
    const rooms = entry?.roomsOnBooks ?? null;
    const revenue =
      rooms !== null && entry?.adr !== undefined ? rooms * entry.adr : null;
    metricsByDate.set(date, { revenue, rooms });
  }

  return metricsByDate;
};

const colorStatusFor = (
  paceGapPct: number | null,
  yellowThresholdPct: number
): ForecastColorStatus => {
  if (paceGapPct === null) {
    return "unavailable";
  }
  if (paceGapPct >= 0) {
    return "green";
  }
  if (paceGapPct >= -yellowThresholdPct) {
    return "yellow";
  }
  return "red";
};

const warningsForForecastRow = (
  tyEntry: PaceEntry | undefined,
  tyMonthStartEntry: PaceEntry | undefined,
  lyMonthStartEntry: PaceEntry | undefined,
  lyPaceEntry: PaceEntry | undefined,
  lyFinalEntry: PaceEntry | undefined,
  rate: number | null
): string[] => {
  const warnings: string[] = [];
  if (!tyEntry) {
    warnings.push("missing_ty_pace");
  }
  if (!tyMonthStartEntry) {
    warnings.push("missing_ty_month_start");
  }
  if (!lyMonthStartEntry) {
    warnings.push("missing_ly_month_start");
  }
  if (!lyPaceEntry) {
    warnings.push("missing_ly_pace");
  }
  if (!lyFinalEntry) {
    warnings.push("missing_ly_final");
  }
  if (rate === null) {
    warnings.push("rate_unavailable");
  }
  return warnings;
};

const nullableDifference = (
  later: number | null,
  earlier: number | null
): number | null =>
  later !== null && earlier !== null ? later - earlier : null;

const paceGapPctFor = (
  paceNet: number | null,
  lyPaceRooms: number | null
): number | null =>
  paceNet !== null && lyPaceRooms !== null && lyPaceRooms > 0
    ? (paceNet / lyPaceRooms) * 100
    : null;

const boundedProjectedRooms = (
  currentRooms: number | null,
  lyPickup: number | null,
  totalRooms: number
): number | null =>
  currentRooms === null || lyPickup === null
    ? null
    : Math.min(Math.max(currentRooms + lyPickup, 0), totalRooms);

const forecastRowForDate = (
  asOf: string,
  date: string,
  context: ForecastRowContext
) => {
  const advanceDays = daysBetween(asOf, date);
  const lyStayDate = sameWeekdayLastYear(date);
  const lySnapshotDate = addDays(lyStayDate, -advanceDays);
  const tyEntry = context.tyEntries.get(date);
  const tyMonthStartEntry = context.tyMonthStartEntries.get(date);
  const lyPaceEntry = context.lyPaceBuckets
    .get(lySnapshotDate)
    ?.entries.find((entry) => entry.forDate === lyStayDate);
  const lyMonthStartEntry = context.lyMonthStartEntries.get(lyStayDate);
  const lyFinalEntry = context.lyFinalEntries.get(lyStayDate);
  const tyRooms = tyEntry?.roomsOnBooks ?? null;
  const tyMonthStartRooms = tyMonthStartEntry?.roomsOnBooks ?? null;
  const tyAdr = tyEntry?.adr ?? null;
  const lyComparableRooms = lyPaceEntry?.roomsOnBooks ?? null;
  const lyMonthStartRooms = lyMonthStartEntry?.roomsOnBooks ?? null;
  const lyFinalRooms = lyFinalEntry?.roomsOnBooks ?? null;
  const tyPaceRooms = nullableDifference(tyRooms, tyMonthStartRooms);
  const lyPaceRooms = nullableDifference(lyComparableRooms, lyMonthStartRooms);
  const lyPickup = nullableDifference(lyFinalRooms, lyComparableRooms);
  const paceNet = nullableDifference(tyPaceRooms, lyPaceRooms);
  const paceGapPct = paceGapPctFor(paceNet, lyPaceRooms);
  const rate = tyAdr ?? context.budgetAdr;
  const forecastLift = lyPickup;
  const projectedRooms = boundedProjectedRooms(
    tyRooms,
    lyPickup,
    context.property.totalRooms
  );

  return {
    date,
    tyMonthStartRooms,
    tyPaceRooms,
    tyRooms,
    tyAdr,
    lyComparableRooms,
    lyMonthStartRooms,
    lyPaceRooms,
    lyRooms: lyComparableRooms,
    lyFinalRooms,
    lyPickup,
    forecastLift,
    lySnapshotDate,
    lyStayDate,
    paceNet,
    paceGapPct,
    colorStatus: colorStatusFor(
      paceGapPct,
      context.property.paceYellowThresholdPct
    ),
    budgetAdr: context.budgetAdr,
    budgetOccupancy: context.budgetOccupancy,
    projectedRooms,
    forecastRooms: projectedRooms,
    projectedRevenue:
      projectedRooms !== null && rate !== null ? projectedRooms * rate : null,
    warnings: warningsForForecastRow(
      tyEntry,
      tyMonthStartEntry,
      lyMonthStartEntry,
      lyPaceEntry,
      lyFinalEntry,
      rate
    ),
  };
};

type ForecastRow = ReturnType<typeof forecastRowForDate>;

const sumActualMetric = (
  metricsByDate: Map<string, ActualMetrics>,
  dates: string[],
  key: keyof ActualMetrics
): { missing: boolean; total: number } => {
  let missing = false;
  let total = 0;

  for (const date of dates) {
    const value = metricsByDate.get(date)?.[key];
    if (typeof value === "number") {
      total += value;
    } else {
      missing = true;
    }
  }

  return { missing, total };
};

const sumForecastValue = (
  rows: ForecastRow[],
  key: "forecastRooms" | "projectedRevenue"
): { missing: boolean; total: number } => {
  let missing = false;
  let total = 0;

  for (const row of rows) {
    const value = row[key];
    if (typeof value === "number") {
      total += value;
    } else {
      missing = true;
    }
  }

  return { missing, total };
};

const monthlyProjectionSummary = (
  rows: ForecastRow[],
  actualMetrics: Map<string, ActualMetrics>,
  actualDates: string[],
  totalRooms: number,
  daysInMonth: number
) => {
  const actualRooms = sumActualMetric(actualMetrics, actualDates, "rooms");
  const actualRevenue = sumActualMetric(actualMetrics, actualDates, "revenue");
  const futureRooms = sumForecastValue(rows, "forecastRooms");
  const futureRevenue = sumForecastValue(rows, "projectedRevenue");
  const projectedRooms =
    actualRooms.missing || futureRooms.missing
      ? null
      : actualRooms.total + futureRooms.total;
  const projectedRevenue =
    actualRevenue.missing || futureRevenue.missing
      ? null
      : actualRevenue.total + futureRevenue.total;
  const availableRoomNights = totalRooms * daysInMonth;
  const projectedOccupancy =
    projectedRooms === null
      ? null
      : (projectedRooms / availableRoomNights) * 100;
  const projectedAdr =
    projectedRooms === null || projectedRevenue === null || projectedRooms === 0
      ? null
      : projectedRevenue / projectedRooms;
  const projectedRevpar =
    projectedRevenue === null ? null : projectedRevenue / availableRoomNights;
  const warnings: string[] = [];

  if (actualRooms.missing) {
    warnings.push("actual_rooms_incomplete");
  }
  if (actualRevenue.missing) {
    warnings.push("actual_revenue_incomplete");
  }
  if (futureRooms.missing) {
    warnings.push("future_rooms_incomplete");
  }
  if (futureRevenue.missing) {
    warnings.push("future_revenue_incomplete");
  }

  return {
    actualDateCount: actualDates.length,
    actualRevenue: actualRevenue.missing ? null : actualRevenue.total,
    actualRooms: actualRooms.missing ? null : actualRooms.total,
    availableRoomNights,
    futureDateCount: rows.length,
    futureRevenue: futureRevenue.missing ? null : futureRevenue.total,
    futureRooms: futureRooms.missing ? null : futureRooms.total,
    projectedAdr,
    projectedOccupancy,
    projectedRevenue,
    projectedRevpar,
    projectedRooms,
    warnings,
  };
};

export const listCompanies = query({
  args: {},
  handler: async (ctx) => {
    const companyRefs = (await ctx.db.query("sourceRefs").collect())
      .filter(
        (ref) =>
          ref.source === "legacy" &&
          ref.sourceTable === "legacyCompanies" &&
          ref.targetTable === "companies"
      )
      .sort((first, second) => first.legacyId - second.legacyId);
    const views = await Promise.all(
      companyRefs.map((ref) => canonicalCompanyView(ctx, ref.legacyId))
    );
    return views.filter((company) => company !== null);
  },
});

export const listProperties = query({
  args: { legacyCompanyId: v.number() },
  handler: async (ctx, args) => {
    const view = await canonicalCompanyView(ctx, args.legacyCompanyId);
    return view ? [view] : [];
  },
});

export const listAudits = query({
  args: {
    legacyCompanyId: v.number(),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.fromDate) {
      assertIsoDate(args.fromDate);
    }
    if (args.toDate) {
      assertIsoDate(args.toDate);
    }

    const companyRef = await sourceRefForLegacyCompany(
      ctx,
      args.legacyCompanyId,
      "companies"
    );
    if (!companyRef) {
      return { items: [], nextCursor: null };
    }

    const audits = (
      await ctx.db
        .query("auditRecords")
        .withIndex("by_companyId", (q) =>
          q.eq("companyId", companyRef.targetId as Id<"companies">)
        )
        .collect()
    )
      .filter(
        (audit) =>
          (!args.fromDate || audit.auditDate >= args.fromDate) &&
          (!args.toDate || audit.auditDate <= args.toDate)
      )
      .sort((first, second) => second.auditDate.localeCompare(first.auditDate));

    const paged = paginate(audits, args.limit, args.cursor);
    const companyName = await canonicalCompanyName(ctx, args.legacyCompanyId);

    return {
      items: await Promise.all(
        paged.items.map(async (audit) => {
          const legacyAuditRef = await sourceRefForTarget(
            ctx,
            "auditRecords",
            audit._id
          );
          return {
            legacyAuditId: legacyAuditRef?.legacyId ?? null,
            legacyCompanyId: args.legacyCompanyId,
            companyName,
            date: audit.auditDate,
            preparedBy: audit.submittedBy,
            comments: null,
          };
        })
      ),
      nextCursor: paged.nextCursor,
    };
  },
});

export const getAuditDetail = query({
  args: { legacyAuditId: v.number() },
  handler: async (ctx, args) =>
    await canonicalAuditDetail(ctx, args.legacyAuditId),
});

export const getAuditPaces = query({
  args: {
    legacyAuditId: v.number(),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const bucket = await ctx.db
      .query("paceSnapshotDays")
      .withIndex("by_legacyAuditId", (q) =>
        q.eq("legacyAuditId", args.legacyAuditId)
      )
      .first();

    if (!bucket) {
      return {
        items: [],
        nextCursor: null,
        warnings: ["No canonical pace bucket found for this audit."],
      };
    }

    const entries = bucket.entries.filter(
      (entry) =>
        (!args.fromDate || entry.forDate >= args.fromDate) &&
        (!args.toDate || entry.forDate <= args.toDate)
    );
    const paged = paginate(entries, args.limit, args.cursor);

    return {
      items: paged.items,
      nextCursor: paged.nextCursor,
      snapshotDate: bucket.snapshotDate,
      legacyAuditId: bucket.legacyAuditId,
      warnings: [],
    };
  },
});

export const listUsers = query({
  args: { legacyCompanyId: v.number() },
  handler: async () => [],
});

export const getHurdleRates = query({
  args: { legacyCompanyId: v.number() },
  handler: async () => [],
});

export const getRoomBudget = query({
  args: { legacyCompanyId: v.number(), year: v.number(), month: v.number() },
  handler: async (ctx, args) => {
    const propertyRef = await sourceRefForLegacyCompany(
      ctx,
      args.legacyCompanyId,
      "properties"
    );
    if (!propertyRef) {
      return [];
    }

    const rows = (
      await ctx.db
        .query("budgets")
        .withIndex("by_propertyId_year", (q) =>
          q
            .eq("propertyId", propertyRef.targetId as Id<"properties">)
            .eq("fiscalYear", args.year)
        )
        .collect()
    ).filter(
      (document) =>
        document.month === args.month && document.categoryId === undefined
    );

    return await Promise.all(
      rows.map(async (document) => {
        const ref = await sourceRefForTarget(ctx, "budgets", document._id);
        return {
          legacyBudgetRoomId: ref?.legacyId ?? null,
          targetOccupancy: document.budgetOccupancy ?? null,
          targetAdr: document.budgetAdr ?? null,
        };
      })
    );
  },
});

export const getRevenueBudget = query({
  args: { legacyCompanyId: v.number(), year: v.number(), month: v.number() },
  handler: async (ctx, args) => {
    const propertyRef = await sourceRefForLegacyCompany(
      ctx,
      args.legacyCompanyId,
      "properties"
    );
    if (!propertyRef) {
      return [];
    }

    const rows = (
      await ctx.db
        .query("budgets")
        .withIndex("by_propertyId_year", (q) =>
          q
            .eq("propertyId", propertyRef.targetId as Id<"properties">)
            .eq("fiscalYear", args.year)
        )
        .collect()
    ).filter(
      (document) =>
        document.month === args.month && document.categoryId !== undefined
    );

    return await Promise.all(
      rows.map(async (document) => {
        const [category, ref] = await Promise.all([
          document.categoryId ? ctx.db.get(document.categoryId) : null,
          sourceRefForTarget(ctx, "budgets", document._id),
        ]);
        const parent = category?.parentId
          ? await ctx.db.get(category.parentId)
          : null;
        return {
          legacyBudgetRevenueId: ref?.legacyId ?? null,
          legacyRevenueCategoryId: null,
          revenueCategory: category?.name ?? null,
          parentCategory: parent?.name ?? null,
          amount: document.budgetAmount ?? null,
        };
      })
    );
  },
});

export const getPaceSnapshot = query({
  args: {
    propertyId: v.id("properties"),
    asOf: v.string(),
    fromDate: v.optional(v.string()),
    toDate: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertIsoDate(args.asOf);
    const bucket = await getPaceBucket(ctx, args.propertyId, args.asOf);
    if (!bucket) {
      return {
        items: [],
        nextCursor: null,
        warnings: [`No pace bucket found for ${args.asOf}.`],
      };
    }

    const entries = bucket.entries.filter(
      (entry) =>
        (!args.fromDate || entry.forDate >= args.fromDate) &&
        (!args.toDate || entry.forDate <= args.toDate)
    );
    const paged = paginate(entries, args.limit, args.cursor);

    return {
      items: paged.items,
      nextCursor: paged.nextCursor,
      propertyId: bucket.propertyId,
      snapshotDate: bucket.snapshotDate,
      legacyAuditId: bucket.legacyAuditId,
      warnings: [],
    };
  },
});

export const getMonthForecast = query({
  args: { propertyId: v.id("properties"), asOf: v.string(), month: v.string() },
  handler: async (ctx, args) => {
    assertIsoDate(args.asOf);
    const property = await ctx.db.get(args.propertyId);
    if (!property) {
      throw new ConvexError("Property not found");
    }

    const { startDate, endDate } = monthRange(args.month);
    const monthDates = datesInRange(startDate, endDate);
    const afterAsOf = addDays(args.asOf, 1);
    const fromDate = afterAsOf > startDate ? afterAsOf : startDate;
    const dates = datesInRange(fromDate, endDate);
    const tyMonthBaselineDate = addDays(startDate, -1);
    const tyBucket = await getPaceBucket(ctx, args.propertyId, args.asOf);
    const tyMonthStartBucket = await getPaceBucket(
      ctx,
      args.propertyId,
      tyMonthBaselineDate
    );

    if (!tyBucket) {
      return {
        propertyId: args.propertyId,
        asOf: args.asOf,
        month: args.month,
        rows: [],
        warnings: [`No TY pace bucket found for ${args.asOf}.`],
      };
    }

    if (!tyMonthStartBucket) {
      return {
        propertyId: args.propertyId,
        asOf: args.asOf,
        month: args.month,
        rows: [],
        warnings: [
          `No TY month-start baseline bucket found for ${tyMonthBaselineDate}.`,
        ],
      };
    }

    const legacyCompanyId = await legacyCompanyIdForProperty(
      ctx,
      args.propertyId
    );
    const [yearText, monthText] = args.month.split("-");
    const roomBudgets = await ctx.db
      .query("budgets")
      .withIndex("by_propertyId_year", (q) =>
        q.eq("propertyId", args.propertyId).eq("fiscalYear", Number(yearText))
      )
      .collect();
    const roomBudget = roomBudgets.find(
      (document) =>
        document.month === Number(monthText) &&
        document.categoryId === undefined
    );
    const budgetAdr = roomBudget?.budgetAdr ?? null;
    const budgetOccupancy = roomBudget?.budgetOccupancy ?? null;
    const tyEntries = entryMapFor(tyBucket.entries);
    const tyMonthStartEntries = entryMapFor(tyMonthStartBucket.entries);
    const lyMonthStartDate = sameWeekdayLastYear(tyMonthBaselineDate);
    const lyMonthStartBucket = await getPaceBucket(
      ctx,
      args.propertyId,
      lyMonthStartDate
    );
    const lyMonthStartEntries = entryMapFor(lyMonthStartBucket?.entries ?? []);
    const lyStayDates = dates.map((date) => sameWeekdayLastYear(date));
    const actualDates = monthDates.filter((date) => date <= args.asOf);
    const [lyFinalEntries, tyActualMetrics] = await Promise.all([
      sameDayPaceEntriesByDate(ctx, args.propertyId, lyStayDates),
      paceActualMetricsByDate(ctx, args.propertyId, actualDates),
    ]);
    const lyPaceBuckets = new Map<string, Doc<"paceSnapshotDays"> | null>();

    for (const date of dates) {
      const advanceDays = daysBetween(args.asOf, date);
      const lyStayDate = sameWeekdayLastYear(date);
      const lySnapshotDate = addDays(lyStayDate, -advanceDays);

      if (!lyPaceBuckets.has(lySnapshotDate)) {
        lyPaceBuckets.set(
          lySnapshotDate,
          await getPaceBucket(ctx, args.propertyId, lySnapshotDate)
        );
      }
    }

    const rows = dates.map((date) =>
      forecastRowForDate(args.asOf, date, {
        budgetAdr,
        budgetOccupancy,
        lyFinalEntries,
        lyMonthStartEntries,
        lyPaceBuckets,
        property,
        tyEntries,
        tyMonthStartEntries,
      })
    );
    const summary = monthlyProjectionSummary(
      rows,
      tyActualMetrics,
      actualDates,
      property.totalRooms,
      monthDates.length
    );

    return {
      propertyId: args.propertyId,
      asOf: args.asOf,
      month: args.month,
      legacyCompanyId,
      rows,
      summary,
      warnings: [],
    };
  },
});
