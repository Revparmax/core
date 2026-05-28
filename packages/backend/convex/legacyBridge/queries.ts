import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { type QueryCtx, query } from "../_generated/server";
import {
  addDays,
  assertIsoDate,
  datesInRange,
  daysBetween,
  monthRange,
  sameDateLastYear,
} from "./dateMath";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

type LegacyDoc = Doc<"legacyCompanies">;
type LegacyRow = Record<string, unknown>;
type PaceEntry = Doc<"paceSnapshotDays">["entries"][number];
type ForecastColorStatus = "green" | "red" | "unavailable" | "yellow";

interface ForecastRowContext {
  budgetAdr: number | null;
  budgetOccupancy: number | null;
  lyBuckets: Map<string, Doc<"paceSnapshotDays"> | null>;
  property: Doc<"properties">;
  tyEntries: Map<string, PaceEntry>;
}

const rowNumber = (row: LegacyRow, key: string): number | undefined =>
  typeof row[key] === "number" ? row[key] : undefined;

const rowString = (row: LegacyRow, key: string): string | undefined =>
  typeof row[key] === "string" ? row[key] : undefined;

const scaledNumber = (value: unknown): number | null =>
  typeof value === "number" ? value / 100 : null;

const nullableString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

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

const legacyCompanyIdForProperty = async (
  ctx: QueryCtx,
  propertyId: Id<"properties">
): Promise<number> => {
  const refs = await ctx.db
    .query("sourceRefs")
    .withIndex("by_target", (q) =>
      q.eq("targetTable", "properties").eq("targetId", propertyId)
    )
    .collect();
  const ref = refs.find((candidate) => candidate.source === "legacy");

  if (!ref) {
    throw new ConvexError("Property is not mapped to a legacy company");
  }

  return ref.legacyId;
};

const legacyCompanyName = async (
  ctx: QueryCtx,
  legacyCompanyId: number
): Promise<string | null> => {
  const company = await ctx.db
    .query("legacyCompanies")
    .withIndex("by_legacyId", (q) => q.eq("legacyId", legacyCompanyId))
    .first();
  return nullableString(company?.row.company_name);
};

const legacyCompanyView = async (ctx: QueryCtx, document: LegacyDoc) => {
  const legacyCompanyId =
    rowNumber(document.row, "company_id") ?? document.legacyId;
  if (legacyCompanyId === undefined) {
    return null;
  }

  const [companyRef, propertyRef] = await Promise.all([
    sourceRefForLegacyCompany(ctx, legacyCompanyId, "companies"),
    sourceRefForLegacyCompany(ctx, legacyCompanyId, "properties"),
  ]);

  return {
    legacyCompanyId,
    companyId: companyRef?.targetId ?? null,
    propertyId: propertyRef?.targetId ?? null,
    name: nullableString(document.row.company_name),
    owner: nullableString(document.row.owner),
    parentLegacyCompanyId: rowNumber(document.row, "parent_id") ?? null,
    totalRooms: rowNumber(document.row, "total_rooms") ?? null,
    status: nullableString(document.row.status),
  };
};

const docsByNumberKey = <T extends { row: LegacyRow }>(
  docs: T[],
  key: string
): Map<number, T> => {
  const byKey = new Map<number, T>();
  for (const document of docs) {
    const value = rowNumber(document.row, key);
    if (value !== undefined) {
      byKey.set(value, document);
    }
  }
  return byKey;
};

const categoryName = (
  categories: Map<number, { row: LegacyRow }>,
  id: number | undefined,
  nameColumn: string
): string | null => {
  if (id === undefined) {
    return null;
  }
  return nullableString(categories.get(id)?.row[nameColumn]) ?? `Unknown ${id}`;
};

const sortedByLegacyId = <T extends { legacyId?: number }>(rows: T[]): T[] =>
  [...rows].sort(
    (first, second) => (first.legacyId ?? 0) - (second.legacyId ?? 0)
  );

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
  lyEntry: PaceEntry | undefined,
  rate: number | null
): string[] => {
  const warnings: string[] = [];
  if (!tyEntry) {
    warnings.push("missing_ty_pace");
  }
  if (!lyEntry) {
    warnings.push("missing_ly_pace");
  }
  if (rate === null) {
    warnings.push("rate_unavailable");
  }
  return warnings;
};

const forecastRowForDate = (
  asOf: string,
  date: string,
  context: ForecastRowContext
) => {
  const advanceDays = daysBetween(asOf, date);
  const lyStayDate = sameDateLastYear(date);
  const lySnapshotDate = addDays(lyStayDate, -advanceDays);
  const tyEntry = context.tyEntries.get(date);
  const lyEntry = context.lyBuckets
    .get(lySnapshotDate)
    ?.entries.find((entry) => entry.forDate === lyStayDate);
  const tyRooms = tyEntry?.roomsOnBooks ?? null;
  const tyAdr = tyEntry?.adr ?? null;
  const lyRooms = lyEntry?.roomsOnBooks ?? null;
  const paceNet =
    tyRooms !== null && lyRooms !== null ? tyRooms - lyRooms : null;
  const paceGapPct =
    tyRooms !== null && lyRooms !== null && lyRooms > 0
      ? ((tyRooms - lyRooms) / lyRooms) * 100
      : null;
  const rate = context.budgetAdr ?? tyAdr;
  const projectedRooms =
    tyRooms === null
      ? null
      : Math.min(Math.max(tyRooms, 0), context.property.totalRooms);

  return {
    date,
    tyRooms,
    tyAdr,
    lyRooms,
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
    projectedRevenue:
      projectedRooms !== null && rate !== null ? projectedRooms * rate : null,
    warnings: warningsForForecastRow(tyEntry, lyEntry, rate),
  };
};

export const listCompanies = query({
  args: {},
  handler: async (ctx) => {
    const companies = await ctx.db.query("legacyCompanies").collect();
    const views = await Promise.all(
      sortedByLegacyId(companies).map((document) =>
        legacyCompanyView(ctx, document)
      )
    );
    return views.filter((company) => company !== null);
  },
});

export const listProperties = query({
  args: { legacyCompanyId: v.number() },
  handler: async (ctx, args) => {
    const company = await ctx.db
      .query("legacyCompanies")
      .withIndex("by_legacyId", (q) => q.eq("legacyId", args.legacyCompanyId))
      .first();

    if (!company) {
      return [];
    }

    const view = await legacyCompanyView(ctx, company);
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

    const audits = (await ctx.db.query("legacyAudits").collect())
      .filter((document) => {
        const row = document.row;
        const auditDate = rowString(row, "date");
        return (
          rowNumber(row, "company_id") === args.legacyCompanyId &&
          auditDate !== undefined &&
          (!args.fromDate || auditDate >= args.fromDate) &&
          (!args.toDate || auditDate <= args.toDate)
        );
      })
      .sort((first, second) =>
        (rowString(first.row, "date") ?? "").localeCompare(
          rowString(second.row, "date") ?? ""
        )
      );

    const paged = paginate(audits, args.limit, args.cursor);
    const companyName = await legacyCompanyName(ctx, args.legacyCompanyId);

    return {
      items: paged.items.map((document) => ({
        legacyAuditId: rowNumber(document.row, "audit_id") ?? document.legacyId,
        legacyCompanyId: args.legacyCompanyId,
        companyName,
        date: rowString(document.row, "date"),
        preparedBy: nullableString(document.row.prepared_by),
        comments: nullableString(document.row.comments),
      })),
      nextCursor: paged.nextCursor,
    };
  },
});

export const getAuditDetail = query({
  args: { legacyAuditId: v.number() },
  handler: async (ctx, args) => {
    const snapshot = await ctx.db
      .query("legacyAuditSnapshots")
      .withIndex("by_legacyAuditId", (q) =>
        q.eq("legacyAuditId", args.legacyAuditId)
      )
      .first();

    return snapshot?.snapshot ?? null;
  },
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
  handler: async (ctx, args) => {
    const users = (await ctx.db.query("legacyUsers").collect()).filter(
      (document) =>
        rowNumber(document.row, "company_id") === args.legacyCompanyId
    );

    return sortedByLegacyId(users).map((document) => ({
      legacyUserId: rowNumber(document.row, "user_id") ?? document.legacyId,
      firstName: nullableString(document.row.first_name),
      lastName: nullableString(document.row.last_name),
      email: nullableString(document.row.email),
      role: nullableString(document.row.role),
      dateJoined: nullableString(document.row.date_joined),
      deleted: rowNumber(document.row, "deleted") === 1,
      passwordHashPresent: typeof document.row.password === "string",
    }));
  },
});

export const getHurdleRates = query({
  args: { legacyCompanyId: v.number() },
  handler: async (ctx, args) => {
    const rows = (await ctx.db.query("legacyHurdleRates").collect()).filter(
      (document) =>
        rowNumber(document.row, "company_id") === args.legacyCompanyId
    );

    return sortedByLegacyId(rows).map((document) => ({
      legacyHurdleRateId:
        rowNumber(document.row, "hurdle_rate_id") ?? document.legacyId,
      bottomRange: rowNumber(document.row, "bottom_range") ?? null,
      topRange: rowNumber(document.row, "top_range") ?? null,
      min: rowNumber(document.row, "min") ?? null,
      max: rowNumber(document.row, "max") ?? null,
    }));
  },
});

export const getRoomBudget = query({
  args: { legacyCompanyId: v.number(), year: v.number(), month: v.number() },
  handler: async (ctx, args) => {
    const rows = (await ctx.db.query("legacyBudgetRooms").collect()).filter(
      (document) =>
        rowNumber(document.row, "company_id") === args.legacyCompanyId &&
        rowNumber(document.row, "year") === args.year &&
        rowNumber(document.row, "month") === args.month
    );

    return sortedByLegacyId(rows).map((document) => ({
      legacyBudgetRoomId:
        rowNumber(document.row, "budget_room_id") ?? document.legacyId,
      targetOccupancy: scaledNumber(document.row.target_occupancy),
      targetAdr: scaledNumber(document.row.target_adr),
    }));
  },
});

export const getRevenueBudget = query({
  args: { legacyCompanyId: v.number(), year: v.number(), month: v.number() },
  handler: async (ctx, args) => {
    const [rows, categories] = await Promise.all([
      ctx.db.query("legacyBudgetRevenues").collect(),
      ctx.db.query("legacyRevenueCategories").collect(),
    ]);
    const categoryById = docsByNumberKey(categories, "revenue_category_id");

    return sortedByLegacyId(
      rows.filter(
        (document) =>
          rowNumber(document.row, "company_id") === args.legacyCompanyId &&
          rowNumber(document.row, "year") === args.year &&
          rowNumber(document.row, "month") === args.month
      )
    ).map((document) => {
      const categoryId = rowNumber(document.row, "revenue_category_id");
      const category = categoryId ? categoryById.get(categoryId) : undefined;
      const parentId = rowNumber(category?.row ?? {}, "parent_category_id");
      return {
        legacyBudgetRevenueId:
          rowNumber(document.row, "budget_revenue_id") ?? document.legacyId,
        legacyRevenueCategoryId: categoryId ?? null,
        revenueCategory: categoryName(
          categoryById,
          categoryId,
          "category_name"
        ),
        parentCategory: categoryName(categoryById, parentId, "category_name"),
        amount: scaledNumber(document.row.amount),
      };
    });
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
    const fromDate = args.asOf > startDate ? args.asOf : startDate;
    const dates = datesInRange(fromDate, endDate);
    const tyBucket = await getPaceBucket(ctx, args.propertyId, args.asOf);

    if (!tyBucket) {
      return {
        propertyId: args.propertyId,
        asOf: args.asOf,
        month: args.month,
        rows: [],
        warnings: [`No TY pace bucket found for ${args.asOf}.`],
      };
    }

    const legacyCompanyId = await legacyCompanyIdForProperty(
      ctx,
      args.propertyId
    );
    const [yearText, monthText] = args.month.split("-");
    const roomBudgets = await ctx.db.query("legacyBudgetRooms").collect();
    const roomBudget = roomBudgets.find(
      (document) =>
        rowNumber(document.row, "company_id") === legacyCompanyId &&
        rowNumber(document.row, "year") === Number(yearText) &&
        rowNumber(document.row, "month") === Number(monthText)
    );
    const budgetAdr = scaledNumber(roomBudget?.row.target_adr);
    const budgetOccupancy = scaledNumber(roomBudget?.row.target_occupancy);
    const tyEntries = entryMapFor(tyBucket.entries);
    const lyBuckets = new Map<string, Doc<"paceSnapshotDays"> | null>();

    for (const date of dates) {
      const advanceDays = daysBetween(args.asOf, date);
      const lyStayDate = sameDateLastYear(date);
      const lySnapshotDate = addDays(lyStayDate, -advanceDays);

      if (!lyBuckets.has(lySnapshotDate)) {
        lyBuckets.set(
          lySnapshotDate,
          await getPaceBucket(ctx, args.propertyId, lySnapshotDate)
        );
      }
    }

    const rows = dates.map((date) =>
      forecastRowForDate(args.asOf, date, {
        budgetAdr,
        budgetOccupancy,
        lyBuckets,
        property,
        tyEntries,
      })
    );

    return {
      propertyId: args.propertyId,
      asOf: args.asOf,
      month: args.month,
      legacyCompanyId,
      rows,
      warnings: [],
    };
  },
});
