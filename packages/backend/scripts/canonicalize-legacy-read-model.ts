import { createReadStream } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import {
  legacyPercentHundredthsToRatio,
  occupancyRatio,
  scaleLegacyHundredths,
} from "./legacy-read-model-transforms";

const repoRoot = path.resolve(import.meta.dir, "../../..");
const defaultSourceDir = path.join(repoRoot, "tmp/legacy-convex-import");
const defaultPacesDir = path.join(
  repoRoot,
  "tmp/legacy-convex-import-filtered-paces"
);
const defaultCompanyIds = new Set([4, 103]);
const defaultAuditSnapshotIds = new Set([20_265, 20_266]);
const DEFAULT_CONVEX_URL = "http://127.0.0.1:3210";
const BATCH_SIZE = 5;
const RECORD_BATCH_SIZE = 100;
const ROOM_CATEGORY_IDS = {
  roomsOccupied: 1,
  adr: 2,
  oooRooms: 3,
  noShows: 4,
  sameDayCancellations: 7,
  compRooms: 11,
} as const;

interface LegacyDocument {
  legacyId?: number;
  row: Record<string, unknown>;
}

interface Options {
  auditSnapshotIds: Set<number>;
  companyIds: Set<number>;
  convexUrl: string;
  pacesDir: string;
  sourceDir: string;
}

interface LegacyCompanyInput {
  legacyCompanyId: number;
  name: string;
  totalRooms: number;
}

interface PaceBucketInput {
  entries: Array<{
    adr?: number;
    forDate: string;
    roomsOnBooks: number;
  }>;
  legacyAuditId: number;
  legacyCompanyId: number;
  snapshotDate: string;
}

interface AuditInfo {
  comments?: string;
  legacyCompanyId: number;
  preparedBy?: string;
  snapshotDate: string;
}

interface RevenueCategoryImport {
  categories: Array<{
    displayOrder: number;
    legacyParentRevenueCategoryId?: number;
    legacyRevenueCategoryId: number;
    name: string;
  }>;
  legacyCompanyId: number;
  parents: Array<{
    displayOrder: number;
    legacyRevenueCategoryId: number;
    name: string;
  }>;
}

interface PaymentTypeImport {
  legacyCompanyId: number;
  paymentTypes: Array<{
    legacyPaymentTypeId: number;
    name: string;
  }>;
}

interface RoomStatisticsImport {
  adr: number;
  compRooms: number;
  legacyAuditId: number;
  noShows: number;
  oooRooms: number;
  roomsOccupied: number;
  sameDayCancellations: number;
}

interface NonRoomRevenueImport {
  amount: number;
  legacyAuditId: number;
  legacyCompanyId: number;
  legacyRevenueCategoryId: number;
  legacyRevenueStatId: number;
  source: string;
}

interface PaymentRecordImport {
  amount: number;
  legacyAuditId: number;
  legacyCompanyId: number;
  legacyPaymentTypeId: number;
  legacyPaymentTypeStatId: number;
  source: string;
}

interface CompetitorImport {
  competitors: Array<{
    enabled: boolean;
    legacyCompetitionId: number;
    name: string;
    totalRooms?: number;
  }>;
  legacyCompanyId: number;
}

interface CompetitionDataImport {
  capturedAt: number;
  dailyOccupancy?: number;
  legacyAuditId: number;
  legacyCompetitionId: number;
  legacyCompetitionStatId: number;
  rate?: number;
}

interface BudgetImport {
  revenueBudgets: Array<{
    amount: number;
    fiscalYear: number;
    legacyBudgetRevenueId: number;
    legacyCompanyId: number;
    legacyRevenueCategoryId: number;
    month: number;
  }>;
  roomBudgets: Array<{
    budgetAdr: number;
    budgetOccupancy: number;
    fiscalYear: number;
    legacyBudgetRoomId: number;
    legacyCompanyId: number;
    month: number;
  }>;
}

interface AuditSnapshotInput {
  auditDate: string;
  legacyAuditId: number;
  legacyCompanyId: number;
  snapshot: unknown;
}

const splitCsv = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const parseCompanyIds = (value: string): Set<number> => {
  const ids = splitCsv(value).map((item) => Number(item));
  if (ids.length === 0 || ids.some((id) => !Number.isInteger(id) || id < 1)) {
    throw new Error("--company-ids must contain positive integer IDs");
  }
  return new Set(ids);
};

const parseAuditSnapshotIds = (value: string): Set<number> => {
  const ids = splitCsv(value).map((item) => Number(item));
  if (ids.length === 0 || ids.some((id) => !Number.isInteger(id) || id < 1)) {
    throw new Error("--audit-snapshot-ids must contain positive integer IDs");
  }
  return new Set(ids);
};

const requireOptionValue = (
  optionName: string,
  value: string | undefined
): string => {
  if (!value) {
    throw new Error(`Missing value for ${optionName}`);
  }
  return value;
};

const printHelp = () => {
  console.log(`
Usage:
  bun scripts/canonicalize-legacy-read-model.ts [options]

Options:
  --source <path>       Raw legacy JSONL directory. Defaults to tmp/legacy-convex-import.
  --paces <path>        Filtered paces JSONL directory. Defaults to tmp/legacy-convex-import-filtered-paces.
  --company-ids <ids>   Comma-separated legacy company IDs. Defaults to 4,103.
  --audit-snapshot-ids <ids>
                       Comma-separated audit IDs to materialize detailed snapshots for. Defaults to 20265,20266.
  --convex-url <url>    Convex URL. Defaults to CONVEX_URL or ${DEFAULT_CONVEX_URL}.
`);
};

const parseArgs = (): Options => {
  const args = process.argv.slice(2);
  const options: Options = {
    auditSnapshotIds: defaultAuditSnapshotIds,
    companyIds: defaultCompanyIds,
    convexUrl: process.env.CONVEX_URL ?? DEFAULT_CONVEX_URL,
    pacesDir: defaultPacesDir,
    sourceDir: defaultSourceDir,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--help") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--source") {
      options.sourceDir = path.resolve(repoRoot, requireOptionValue(arg, next));
      index += 1;
      continue;
    }
    if (arg === "--paces") {
      options.pacesDir = path.resolve(repoRoot, requireOptionValue(arg, next));
      index += 1;
      continue;
    }
    if (arg === "--company-ids") {
      options.companyIds = parseCompanyIds(requireOptionValue(arg, next));
      index += 1;
      continue;
    }
    if (arg === "--audit-snapshot-ids") {
      options.auditSnapshotIds = parseAuditSnapshotIds(
        requireOptionValue(arg, next)
      );
      index += 1;
      continue;
    }
    if (arg === "--convex-url") {
      options.convexUrl = requireOptionValue(arg, next);
      index += 1;
      continue;
    }

    throw new Error(`Unknown or incomplete option: ${arg}`);
  }

  return options;
};

const readJsonl = async function* (
  filePath: string
): AsyncGenerator<LegacyDocument> {
  const lines = createInterface({ input: createReadStream(filePath) });

  for await (const line of lines) {
    if (line.trim().length === 0) {
      continue;
    }
    yield JSON.parse(line) as LegacyDocument;
  }
};

const numberFromRow = (
  row: Record<string, unknown>,
  columnName: string
): number | undefined => {
  const value = row[columnName];
  return typeof value === "number" ? value : undefined;
};

const stringFromRow = (
  row: Record<string, unknown>,
  columnName: string
): string | undefined => {
  const value = row[columnName];
  return typeof value === "string" ? value : undefined;
};

const nullableScaled = (value: unknown): number | null =>
  typeof value === "number" ? value / 100 : null;

const nullableString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const docsByNumberKey = (
  docs: LegacyDocument[],
  key: string
): Map<number, LegacyDocument> => {
  const byKey = new Map<number, LegacyDocument>();
  for (const document of docs) {
    const value = numberFromRow(document.row, key);
    if (value !== undefined) {
      byKey.set(value, document);
    }
  }
  return byKey;
};

const docsByAuditIdFromTable = async (
  sourceDir: string,
  tableName: string,
  auditIds: Set<number>
): Promise<Map<number, LegacyDocument[]>> => {
  const byAuditId = new Map<number, LegacyDocument[]>();
  const filePath = path.join(sourceDir, tableName, "documents.jsonl");

  for await (const document of readJsonl(filePath)) {
    const auditId = numberFromRow(document.row, "audit_id");
    if (auditId === undefined || !auditIds.has(auditId)) {
      continue;
    }
    const rows = byAuditId.get(auditId) ?? [];
    rows.push(document);
    byAuditId.set(auditId, rows);
  }

  return byAuditId;
};

const sortedByLegacyId = (docs: LegacyDocument[]): LegacyDocument[] =>
  [...docs].sort(
    (first, second) => (first.legacyId ?? 0) - (second.legacyId ?? 0)
  );

const categoryName = (
  docs: Map<number, LegacyDocument>,
  id: number | undefined,
  nameColumn: string
): string | null => {
  if (id === undefined) {
    return null;
  }
  return nullableString(docs.get(id)?.row[nameColumn]) ?? `Unknown ${id}`;
};

const docsForTable = async (
  sourceDir: string,
  tableName: string
): Promise<LegacyDocument[]> => {
  const rows: LegacyDocument[] = [];
  for await (const document of readJsonl(
    path.join(sourceDir, tableName, "documents.jsonl")
  )) {
    rows.push(document);
  }
  return rows;
};

const loadCompanies = async (
  options: Options
): Promise<LegacyCompanyInput[]> => {
  const companies: LegacyCompanyInput[] = [];
  const filePath = path.join(
    options.sourceDir,
    "legacyCompanies",
    "documents.jsonl"
  );

  for await (const document of readJsonl(filePath)) {
    const legacyCompanyId = numberFromRow(document.row, "company_id");
    const name = stringFromRow(document.row, "company_name");
    const totalRooms = numberFromRow(document.row, "total_rooms");

    if (
      legacyCompanyId !== undefined &&
      name !== undefined &&
      totalRooms !== undefined &&
      options.companyIds.has(legacyCompanyId)
    ) {
      companies.push({ legacyCompanyId, name, totalRooms });
    }
  }

  return companies;
};

const loadAudits = async (
  options: Options
): Promise<Map<number, AuditInfo>> => {
  const audits = new Map<number, AuditInfo>();
  const filePath = path.join(
    options.sourceDir,
    "legacyAudits",
    "documents.jsonl"
  );

  for await (const document of readJsonl(filePath)) {
    const legacyAuditId = numberFromRow(document.row, "audit_id");
    const legacyCompanyId = numberFromRow(document.row, "company_id");
    const snapshotDate = stringFromRow(document.row, "date");

    if (
      legacyAuditId !== undefined &&
      legacyCompanyId !== undefined &&
      snapshotDate !== undefined &&
      options.companyIds.has(legacyCompanyId)
    ) {
      audits.set(legacyAuditId, {
        comments: stringFromRow(document.row, "comments"),
        legacyCompanyId,
        preparedBy: stringFromRow(document.row, "prepared_by"),
        snapshotDate,
      });
    }
  }

  return audits;
};

const loadRevenueCategories = async (
  options: Options
): Promise<RevenueCategoryImport[]> => {
  const rows = await docsForTable(options.sourceDir, "legacyRevenueCategories");
  const categoriesById = docsByNumberKey(rows, "revenue_category_id");
  const imports: RevenueCategoryImport[] = [];

  for (const legacyCompanyId of options.companyIds) {
    const categoryRows = rows.filter((document) => {
      const parentId = numberFromRow(document.row, "parent_category_id");
      const companyId = numberFromRow(document.row, "company_id");
      return (
        parentId !== undefined &&
        (companyId === undefined || companyId === legacyCompanyId)
      );
    });
    const parentIds = new Set(
      categoryRows
        .map((document) => numberFromRow(document.row, "parent_category_id"))
        .filter((value) => value !== undefined)
    );
    const parents = [...parentIds]
      .map((legacyRevenueCategoryId, index) => {
        const parent = categoriesById.get(legacyRevenueCategoryId);
        const name = nullableString(parent?.row.category_name);
        return name
          ? {
              displayOrder: index,
              legacyRevenueCategoryId,
              name,
            }
          : null;
      })
      .filter((value) => value !== null);

    imports.push({
      legacyCompanyId,
      parents,
      categories: categoryRows
        .map((document, index) => {
          const legacyRevenueCategoryId = numberFromRow(
            document.row,
            "revenue_category_id"
          );
          const name = nullableString(document.row.category_name);
          if (legacyRevenueCategoryId === undefined || name === null) {
            return null;
          }
          return {
            displayOrder: index,
            legacyParentRevenueCategoryId: numberFromRow(
              document.row,
              "parent_category_id"
            ),
            legacyRevenueCategoryId,
            name,
          };
        })
        .filter((value) => value !== null),
    });
  }

  return imports;
};

const loadPaymentTypes = async (
  options: Options
): Promise<PaymentTypeImport[]> => {
  const rows = await docsForTable(options.sourceDir, "legacyPaymentTypes");

  return [...options.companyIds].map((legacyCompanyId) => ({
    legacyCompanyId,
    paymentTypes: rows
      .filter((document) => {
        const companyId = numberFromRow(document.row, "company_id");
        return companyId === undefined || companyId === legacyCompanyId;
      })
      .map((document) => {
        const legacyPaymentTypeId = numberFromRow(
          document.row,
          "payment_type_id"
        );
        const name = nullableString(document.row.payment_name);
        return legacyPaymentTypeId === undefined || name === null
          ? null
          : { legacyPaymentTypeId, name };
      })
      .filter((value) => value !== null),
  }));
};

const auditRowsForMutation = (audits: Map<number, AuditInfo>) =>
  [...audits.entries()].map(([legacyAuditId, audit]) => ({
    legacyAuditId,
    legacyCompanyId: audit.legacyCompanyId,
    auditDate: audit.snapshotDate,
    submittedBy: audit.preparedBy ?? "legacy-import",
  }));

const loadRoomStatistics = async (
  options: Options,
  audits: Map<number, AuditInfo>
): Promise<RoomStatisticsImport[]> => {
  const byAuditId = new Map<number, Partial<RoomStatisticsImport>>();

  for await (const document of readJsonl(
    path.join(options.sourceDir, "legacyRoomStats", "documents.jsonl")
  )) {
    const legacyAuditId = numberFromRow(document.row, "audit_id");
    const categoryId = numberFromRow(document.row, "room_category_id");
    const value = scaleLegacyHundredths(numberFromRow(document.row, "amount"));
    if (
      legacyAuditId === undefined ||
      categoryId === undefined ||
      value === undefined ||
      !audits.has(legacyAuditId)
    ) {
      continue;
    }

    const row = byAuditId.get(legacyAuditId) ?? { legacyAuditId };
    if (categoryId === ROOM_CATEGORY_IDS.roomsOccupied) {
      row.roomsOccupied = value;
    }
    if (categoryId === ROOM_CATEGORY_IDS.adr) {
      row.adr = value;
    }
    if (categoryId === ROOM_CATEGORY_IDS.oooRooms) {
      row.oooRooms = value;
    }
    if (categoryId === ROOM_CATEGORY_IDS.noShows) {
      row.noShows = value;
    }
    if (categoryId === ROOM_CATEGORY_IDS.sameDayCancellations) {
      row.sameDayCancellations = value;
    }
    if (categoryId === ROOM_CATEGORY_IDS.compRooms) {
      row.compRooms = value;
    }
    byAuditId.set(legacyAuditId, row);
  }

  return [...byAuditId.values()].map((row) => ({
    legacyAuditId: row.legacyAuditId ?? 0,
    roomsOccupied: row.roomsOccupied ?? 0,
    adr: row.adr ?? 0,
    sameDayCancellations: row.sameDayCancellations ?? 0,
    noShows: row.noShows ?? 0,
    compRooms: row.compRooms ?? 0,
    oooRooms: row.oooRooms ?? 0,
  }));
};

const loadNonRoomRevenue = async (
  options: Options,
  audits: Map<number, AuditInfo>
): Promise<NonRoomRevenueImport[]> => {
  const categories = docsByNumberKey(
    await docsForTable(options.sourceDir, "legacyRevenueCategories"),
    "revenue_category_id"
  );
  const rows: NonRoomRevenueImport[] = [];

  for await (const document of readJsonl(
    path.join(options.sourceDir, "legacyRevenueStats", "documents.jsonl")
  )) {
    const legacyAuditId = numberFromRow(document.row, "audit_id");
    const audit =
      legacyAuditId === undefined ? undefined : audits.get(legacyAuditId);
    const legacyRevenueStatId =
      numberFromRow(document.row, "revenue_stat_id") ?? document.legacyId;
    const legacyRevenueCategoryId = numberFromRow(
      document.row,
      "revenue_category_id"
    );
    const amount = scaleLegacyHundredths(numberFromRow(document.row, "amount"));

    if (
      audit === undefined ||
      legacyAuditId === undefined ||
      legacyRevenueStatId === undefined ||
      legacyRevenueCategoryId === undefined ||
      amount === undefined
    ) {
      continue;
    }

    rows.push({
      legacyRevenueStatId,
      legacyAuditId,
      legacyCompanyId: audit.legacyCompanyId,
      legacyRevenueCategoryId,
      amount,
      source:
        nullableString(
          categories.get(legacyRevenueCategoryId)?.row.category_name
        ) ?? `legacy-revenue-category-${legacyRevenueCategoryId}`,
    });
  }

  return rows;
};

const loadPaymentRecords = async (
  options: Options,
  audits: Map<number, AuditInfo>
): Promise<PaymentRecordImport[]> => {
  const paymentTypes = docsByNumberKey(
    await docsForTable(options.sourceDir, "legacyPaymentTypes"),
    "payment_type_id"
  );
  const rows: PaymentRecordImport[] = [];

  for await (const document of readJsonl(
    path.join(options.sourceDir, "legacyPaymentTypeStats", "documents.jsonl")
  )) {
    const legacyAuditId = numberFromRow(document.row, "audit_id");
    const audit =
      legacyAuditId === undefined ? undefined : audits.get(legacyAuditId);
    const legacyPaymentTypeStatId =
      numberFromRow(document.row, "payment_type_stat_id") ?? document.legacyId;
    const legacyPaymentTypeId = numberFromRow(document.row, "payment_type_id");
    const amount = scaleLegacyHundredths(numberFromRow(document.row, "amount"));

    if (
      audit === undefined ||
      legacyAuditId === undefined ||
      legacyPaymentTypeStatId === undefined ||
      legacyPaymentTypeId === undefined ||
      amount === undefined
    ) {
      continue;
    }

    rows.push({
      legacyPaymentTypeStatId,
      legacyAuditId,
      legacyCompanyId: audit.legacyCompanyId,
      legacyPaymentTypeId,
      amount,
      source:
        nullableString(
          paymentTypes.get(legacyPaymentTypeId)?.row.payment_name
        ) ?? `legacy-payment-type-${legacyPaymentTypeId}`,
    });
  }

  return rows;
};

const loadCompetitors = async (
  options: Options
): Promise<CompetitorImport[]> => {
  const rows = await docsForTable(options.sourceDir, "legacyCompetitions");

  return [...options.companyIds].map((legacyCompanyId) => ({
    legacyCompanyId,
    competitors: rows
      .filter(
        (document) =>
          numberFromRow(document.row, "company_id") === legacyCompanyId
      )
      .map((document) => {
        const legacyCompetitionId =
          numberFromRow(document.row, "competition_id") ?? document.legacyId;
        const name = nullableString(document.row.company_name);
        if (legacyCompetitionId === undefined || name === null) {
          return null;
        }
        const totalRooms = scaleLegacyHundredths(
          numberFromRow(document.row, "total_rooms")
        );
        return {
          legacyCompetitionId,
          name,
          enabled: numberFromRow(document.row, "enabled") === 1,
          ...(totalRooms === undefined ? {} : { totalRooms }),
        };
      })
      .filter((value) => value !== null),
  }));
};

const loadCompetitionData = async (
  options: Options,
  audits: Map<number, AuditInfo>
): Promise<CompetitionDataImport[]> => {
  const competitions = docsByNumberKey(
    await docsForTable(options.sourceDir, "legacyCompetitions"),
    "competition_id"
  );
  const rows: CompetitionDataImport[] = [];

  for await (const document of readJsonl(
    path.join(options.sourceDir, "legacyCompetitionStats", "documents.jsonl")
  )) {
    const legacyAuditId = numberFromRow(document.row, "audit_id");
    const audit =
      legacyAuditId === undefined ? undefined : audits.get(legacyAuditId);
    const legacyCompetitionStatId =
      numberFromRow(document.row, "competition_stat_id") ?? document.legacyId;
    const legacyCompetitionId = numberFromRow(document.row, "competition_id");
    const rate = scaleLegacyHundredths(numberFromRow(document.row, "rate"));
    const occupiedRooms = scaleLegacyHundredths(
      numberFromRow(document.row, "occupied_rooms")
    );
    const totalRooms =
      legacyCompetitionId === undefined
        ? undefined
        : scaleLegacyHundredths(
            numberFromRow(
              competitions.get(legacyCompetitionId)?.row ?? {},
              "total_rooms"
            )
          );
    const dailyOccupancy = occupancyRatio(occupiedRooms, totalRooms);

    if (
      audit === undefined ||
      legacyAuditId === undefined ||
      legacyCompetitionStatId === undefined ||
      legacyCompetitionId === undefined
    ) {
      continue;
    }

    rows.push({
      legacyCompetitionStatId,
      legacyAuditId,
      legacyCompetitionId,
      capturedAt: Date.parse(`${audit.snapshotDate}T00:00:00.000Z`),
      ...(rate === undefined ? {} : { rate }),
      ...(dailyOccupancy === undefined ? {} : { dailyOccupancy }),
    });
  }

  return rows;
};

const loadBudgets = async (options: Options): Promise<BudgetImport> => {
  const roomBudgets: BudgetImport["roomBudgets"] = [];
  const revenueBudgets: BudgetImport["revenueBudgets"] = [];

  for await (const document of readJsonl(
    path.join(options.sourceDir, "legacyBudgetRooms", "documents.jsonl")
  )) {
    const legacyCompanyId = numberFromRow(document.row, "company_id");
    const legacyBudgetRoomId =
      numberFromRow(document.row, "budget_room_id") ?? document.legacyId;
    const month = numberFromRow(document.row, "month");
    const fiscalYear = numberFromRow(document.row, "year");
    const budgetOccupancy = legacyPercentHundredthsToRatio(
      numberFromRow(document.row, "target_occupancy")
    );
    const budgetAdr = scaleLegacyHundredths(
      numberFromRow(document.row, "target_adr")
    );

    if (
      legacyCompanyId === undefined ||
      legacyBudgetRoomId === undefined ||
      month === undefined ||
      fiscalYear === undefined ||
      budgetOccupancy === undefined ||
      budgetAdr === undefined ||
      !options.companyIds.has(legacyCompanyId)
    ) {
      continue;
    }

    roomBudgets.push({
      legacyBudgetRoomId,
      legacyCompanyId,
      fiscalYear,
      month,
      budgetOccupancy,
      budgetAdr,
    });
  }

  for await (const document of readJsonl(
    path.join(options.sourceDir, "legacyBudgetRevenues", "documents.jsonl")
  )) {
    const legacyCompanyId = numberFromRow(document.row, "company_id");
    const legacyBudgetRevenueId =
      numberFromRow(document.row, "budget_revenue_id") ?? document.legacyId;
    const legacyRevenueCategoryId = numberFromRow(
      document.row,
      "revenue_category_id"
    );
    const month = numberFromRow(document.row, "month");
    const fiscalYear = numberFromRow(document.row, "year");
    const amount = scaleLegacyHundredths(numberFromRow(document.row, "amount"));

    if (
      legacyCompanyId === undefined ||
      legacyBudgetRevenueId === undefined ||
      legacyRevenueCategoryId === undefined ||
      month === undefined ||
      fiscalYear === undefined ||
      amount === undefined ||
      !options.companyIds.has(legacyCompanyId)
    ) {
      continue;
    }

    revenueBudgets.push({
      legacyBudgetRevenueId,
      legacyCompanyId,
      legacyRevenueCategoryId,
      fiscalYear,
      month,
      amount,
    });
  }

  return { revenueBudgets, roomBudgets };
};

const _loadAuditSnapshots = async (
  options: Options,
  audits: Map<number, AuditInfo>
): Promise<AuditSnapshotInput[]> => {
  const snapshotAuditIds = new Set(
    [...audits.keys()].filter((auditId) =>
      options.auditSnapshotIds.has(auditId)
    )
  );
  const [
    companies,
    roomCategories,
    revenueCategories,
    paymentTypes,
    competitions,
    competitionExtcodes,
    auditDataTypes,
    roomStatsByAudit,
    revenueStatsByAudit,
    paymentStatsByAudit,
    competitionStatsByAudit,
    filesByAudit,
    receivedTypesByAudit,
  ] = await Promise.all([
    docsForTable(options.sourceDir, "legacyCompanies"),
    docsForTable(options.sourceDir, "legacyRoomCategories"),
    docsForTable(options.sourceDir, "legacyRevenueCategories"),
    docsForTable(options.sourceDir, "legacyPaymentTypes"),
    docsForTable(options.sourceDir, "legacyCompetitions"),
    docsForTable(options.sourceDir, "legacyCompetitionExtcodes"),
    docsForTable(options.sourceDir, "legacyAuditDataTypes"),
    docsByAuditIdFromTable(
      options.sourceDir,
      "legacyRoomStats",
      snapshotAuditIds
    ),
    docsByAuditIdFromTable(
      options.sourceDir,
      "legacyRevenueStats",
      snapshotAuditIds
    ),
    docsByAuditIdFromTable(
      options.sourceDir,
      "legacyPaymentTypeStats",
      snapshotAuditIds
    ),
    docsByAuditIdFromTable(
      options.sourceDir,
      "legacyCompetitionStats",
      snapshotAuditIds
    ),
    docsByAuditIdFromTable(options.sourceDir, "legacyFiles", snapshotAuditIds),
    docsByAuditIdFromTable(
      options.sourceDir,
      "legacyReceivedAuditDataTypes",
      snapshotAuditIds
    ),
  ]);

  const companyById = docsByNumberKey(companies, "company_id");
  const roomCategoryById = docsByNumberKey(roomCategories, "room_category_id");
  const revenueCategoryById = docsByNumberKey(
    revenueCategories,
    "revenue_category_id"
  );
  const paymentTypeById = docsByNumberKey(paymentTypes, "payment_type_id");
  const competitionById = docsByNumberKey(competitions, "competition_id");
  const auditDataTypeById = docsByNumberKey(
    auditDataTypes,
    "audit_data_type_id"
  );
  const extcodesByCompetitionId = new Map<number, string[]>();

  for (const extcode of competitionExtcodes) {
    const competitionId = numberFromRow(extcode.row, "competition_id");
    if (competitionId === undefined) {
      continue;
    }
    const values = extcodesByCompetitionId.get(competitionId) ?? [];
    values.push(
      `${stringFromRow(extcode.row, "source") ?? "unknown"}:${
        stringFromRow(extcode.row, "external_code") ?? ""
      }`
    );
    extcodesByCompetitionId.set(competitionId, values);
  }

  return [...audits.entries()]
    .filter(([legacyAuditId]) => snapshotAuditIds.has(legacyAuditId))
    .map(([legacyAuditId, audit]) => {
      const company = companyById.get(audit.legacyCompanyId);
      return {
        auditDate: audit.snapshotDate,
        legacyAuditId,
        legacyCompanyId: audit.legacyCompanyId,
        snapshot: {
          audit: {
            legacyAuditId,
            legacyCompanyId: audit.legacyCompanyId,
            companyName: nullableString(company?.row.company_name),
            date: audit.snapshotDate,
            preparedBy: audit.preparedBy ?? null,
            comments: audit.comments ?? null,
          },
          roomStats: sortedByLegacyId(
            roomStatsByAudit.get(legacyAuditId) ?? []
          ).map((document) => {
            const categoryId = numberFromRow(document.row, "room_category_id");
            return {
              legacyRoomStatId:
                numberFromRow(document.row, "room_stat_id") ??
                document.legacyId,
              legacyRoomCategoryId: categoryId ?? null,
              roomCategory: categoryName(
                roomCategoryById,
                categoryId,
                "category_name"
              ),
              amount: nullableScaled(document.row.amount),
            };
          }),
          revenueStats: sortedByLegacyId(
            revenueStatsByAudit.get(legacyAuditId) ?? []
          ).map((document) => {
            const categoryId = numberFromRow(
              document.row,
              "revenue_category_id"
            );
            const category = categoryId
              ? revenueCategoryById.get(categoryId)
              : undefined;
            const parentId = numberFromRow(
              category?.row ?? {},
              "parent_category_id"
            );
            return {
              legacyRevenueStatId:
                numberFromRow(document.row, "revenue_stat_id") ??
                document.legacyId,
              legacyRevenueCategoryId: categoryId ?? null,
              revenueCategory: categoryName(
                revenueCategoryById,
                categoryId,
                "category_name"
              ),
              parentCategory: categoryName(
                revenueCategoryById,
                parentId,
                "category_name"
              ),
              amount: nullableScaled(document.row.amount),
            };
          }),
          paymentTypeStats: sortedByLegacyId(
            paymentStatsByAudit.get(legacyAuditId) ?? []
          ).map((document) => {
            const paymentTypeId = numberFromRow(
              document.row,
              "payment_type_id"
            );
            return {
              legacyPaymentTypeStatId:
                numberFromRow(document.row, "payment_type_stat_id") ??
                document.legacyId,
              legacyPaymentTypeId: paymentTypeId ?? null,
              paymentType: categoryName(
                paymentTypeById,
                paymentTypeId,
                "payment_name"
              ),
              amount: nullableScaled(document.row.amount),
            };
          }),
          competitionStats: sortedByLegacyId(
            competitionStatsByAudit.get(legacyAuditId) ?? []
          ).map((document) => {
            const competitionId = numberFromRow(document.row, "competition_id");
            const competition = competitionId
              ? competitionById.get(competitionId)
              : undefined;
            return {
              legacyCompetitionStatId:
                numberFromRow(document.row, "competition_stat_id") ??
                document.legacyId,
              legacyCompetitionId: competitionId ?? null,
              competitor: nullableString(competition?.row.company_name),
              totalRooms: nullableScaled(competition?.row.total_rooms),
              enabled: numberFromRow(competition?.row ?? {}, "enabled") === 1,
              extcodes: competitionId
                ? (extcodesByCompetitionId.get(competitionId) ?? [])
                : [],
              rate: nullableScaled(document.row.rate),
              occupiedRooms: nullableScaled(document.row.occupied_rooms),
            };
          }),
          files: sortedByLegacyId(filesByAudit.get(legacyAuditId) ?? []).map(
            (document) => ({
              legacyFileId:
                numberFromRow(document.row, "file_id") ?? document.legacyId,
              title: nullableString(document.row.file_title),
              filename: nullableString(document.row.file_name),
              mimeType: nullableString(document.row.file_mimetype),
              size: numberFromRow(document.row, "file_size") ?? null,
            })
          ),
          receivedAuditDataTypes: sortedByLegacyId(
            receivedTypesByAudit.get(legacyAuditId) ?? []
          ).map((document) => {
            const typeId = numberFromRow(document.row, "audit_data_type_id");
            const auditDataType = typeId
              ? auditDataTypeById.get(typeId)
              : undefined;
            return {
              legacyReceivedAuditDataTypeId:
                numberFromRow(document.row, "received_audit_data_type_id") ??
                document.legacyId,
              legacyAuditDataTypeId: typeId ?? null,
              auditDataType: categoryName(
                auditDataTypeById,
                typeId,
                "audit_data_type_name"
              ),
              source: nullableString(auditDataType?.row.source),
              receivedTimestamp: nullableString(
                document.row.received_timestamp
              ),
              method: nullableString(document.row.method),
            };
          }),
        },
      };
    });
};

const loadPaceBuckets = async (
  options: Options,
  audits: Map<number, { legacyCompanyId: number; snapshotDate: string }>
): Promise<PaceBucketInput[]> => {
  const buckets = new Map<number, PaceBucketInput>();
  const filePath = path.join(
    options.pacesDir,
    "legacyPaces",
    "documents.jsonl"
  );

  for await (const document of readJsonl(filePath)) {
    const legacyAuditId = numberFromRow(document.row, "audit_id");
    const forDate = stringFromRow(document.row, "for_date");
    const rooms = scaleLegacyHundredths(numberFromRow(document.row, "rooms"));

    if (
      legacyAuditId === undefined ||
      forDate === undefined ||
      rooms === undefined
    ) {
      continue;
    }

    const audit = audits.get(legacyAuditId);
    if (!audit) {
      continue;
    }

    const bucket =
      buckets.get(legacyAuditId) ??
      ({
        entries: [],
        legacyAuditId,
        legacyCompanyId: audit.legacyCompanyId,
        snapshotDate: audit.snapshotDate,
      } satisfies PaceBucketInput);

    const adr = scaleLegacyHundredths(numberFromRow(document.row, "adr"));
    bucket.entries.push({
      forDate,
      roomsOnBooks: rooms,
      ...(adr === undefined ? {} : { adr }),
    });
    buckets.set(legacyAuditId, bucket);
  }

  return [...buckets.values()].map((bucket) => ({
    ...bucket,
    entries: bucket.entries.sort((first, second) =>
      first.forDate.localeCompare(second.forDate)
    ),
  }));
};

const chunked = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const main = async () => {
  const options = parseArgs();
  const client = new ConvexHttpClient(options.convexUrl);

  const companies = await loadCompanies(options);
  await client.mutation(
    anyApi.legacyBridge.importMutations.upsertLegacyProperties,
    {
      companies,
    }
  );
  console.log(`Canonicalized ${companies.length} legacy companies/properties.`);

  const audits = await loadAudits(options);
  const revenueCategoryImports = await loadRevenueCategories(options);
  for (const categoryImport of revenueCategoryImports) {
    const result = await client.mutation(
      anyApi.legacyBridge.importMutations.upsertLegacyRevenueCategories,
      categoryImport
    );
    console.log(
      `Canonicalized ${result.upsertedParents} revenue parents and ${result.upsertedCategories} revenue categories for legacy company ${categoryImport.legacyCompanyId}.`
    );
  }

  const paymentTypeImports = await loadPaymentTypes(options);
  for (const paymentTypeImport of paymentTypeImports) {
    const result = await client.mutation(
      anyApi.legacyBridge.importMutations.upsertLegacyPaymentTypes,
      paymentTypeImport
    );
    console.log(
      `Canonicalized ${result.upserted} payment types for legacy company ${paymentTypeImport.legacyCompanyId}.`
    );
  }

  let auditsUpserted = 0;
  for (const batch of chunked(
    auditRowsForMutation(audits),
    RECORD_BATCH_SIZE
  )) {
    const result = await client.mutation(
      anyApi.legacyBridge.importMutations.upsertLegacyAudits,
      { audits: batch }
    );
    auditsUpserted += Number(result.upserted);
    console.log(`Upserted ${auditsUpserted}/${audits.size} audit records.`);
  }

  const roomStatistics = await loadRoomStatistics(options, audits);
  let roomStatisticsUpserted = 0;
  for (const batch of chunked(roomStatistics, RECORD_BATCH_SIZE)) {
    const result = await client.mutation(
      anyApi.legacyBridge.importMutations.upsertLegacyRoomStatistics,
      { rows: batch }
    );
    roomStatisticsUpserted += Number(result.upserted);
    console.log(
      `Upserted ${roomStatisticsUpserted}/${roomStatistics.length} room statistic records.`
    );
  }

  const nonRoomRevenue = await loadNonRoomRevenue(options, audits);
  let nonRoomRevenueSkipped = 0;
  let nonRoomRevenueUpserted = 0;
  for (const batch of chunked(nonRoomRevenue, RECORD_BATCH_SIZE)) {
    const result = await client.mutation(
      anyApi.legacyBridge.importMutations.upsertLegacyNonRoomRevenue,
      { rows: batch }
    );
    nonRoomRevenueSkipped += Number(result.skipped);
    nonRoomRevenueUpserted += Number(result.upserted);
    console.log(
      `Upserted ${nonRoomRevenueUpserted}/${nonRoomRevenue.length} non-room revenue records (${nonRoomRevenueSkipped} skipped).`
    );
  }

  const paymentRecords = await loadPaymentRecords(options, audits);
  let paymentRecordsSkipped = 0;
  let paymentRecordsUpserted = 0;
  for (const batch of chunked(paymentRecords, RECORD_BATCH_SIZE)) {
    const result = await client.mutation(
      anyApi.legacyBridge.importMutations.upsertLegacyPaymentRecords,
      { rows: batch }
    );
    paymentRecordsSkipped += Number(result.skipped);
    paymentRecordsUpserted += Number(result.upserted);
    console.log(
      `Upserted ${paymentRecordsUpserted}/${paymentRecords.length} payment records (${paymentRecordsSkipped} skipped).`
    );
  }

  const competitorImports = await loadCompetitors(options);
  for (const competitorImport of competitorImports) {
    const result = await client.mutation(
      anyApi.legacyBridge.importMutations.upsertLegacyCompetitors,
      competitorImport
    );
    console.log(
      `Canonicalized ${result.upserted} competitors for legacy company ${competitorImport.legacyCompanyId}.`
    );
  }

  const competitionData = await loadCompetitionData(options, audits);
  let competitionDataSkipped = 0;
  let competitionDataUpserted = 0;
  for (const batch of chunked(competitionData, RECORD_BATCH_SIZE)) {
    const result = await client.mutation(
      anyApi.legacyBridge.importMutations.upsertLegacyCompetitionData,
      { rows: batch }
    );
    competitionDataSkipped += Number(result.skipped);
    competitionDataUpserted += Number(result.upserted);
    console.log(
      `Upserted ${competitionDataUpserted}/${competitionData.length} competition data records (${competitionDataSkipped} skipped).`
    );
  }

  const budgets = await loadBudgets(options);
  let budgetsSkipped = 0;
  let budgetsUpserted = 0;
  for (const batch of chunked(budgets.roomBudgets, RECORD_BATCH_SIZE)) {
    const result = await client.mutation(
      anyApi.legacyBridge.importMutations.upsertLegacyBudgets,
      { roomBudgets: batch, revenueBudgets: [] }
    );
    budgetsSkipped += Number(result.skipped);
    budgetsUpserted += Number(result.upserted);
  }
  for (const batch of chunked(budgets.revenueBudgets, RECORD_BATCH_SIZE)) {
    const result = await client.mutation(
      anyApi.legacyBridge.importMutations.upsertLegacyBudgets,
      { roomBudgets: [], revenueBudgets: batch }
    );
    budgetsSkipped += Number(result.skipped);
    budgetsUpserted += Number(result.upserted);
  }
  console.log(
    `Upserted ${budgetsUpserted} budget records (${budgetsSkipped} skipped).`
  );

  const buckets = await loadPaceBuckets(options, audits);
  let upserted = 0;

  for (const batch of chunked(buckets, BATCH_SIZE)) {
    const result = await client.mutation(
      anyApi.legacyBridge.importMutations.upsertPaceSnapshotDays,
      { buckets: batch }
    );
    upserted += Number(result.upserted);
    console.log(`Upserted ${upserted}/${buckets.length} pace buckets.`);
  }

  console.log("Legacy read model canonicalization complete.");
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
