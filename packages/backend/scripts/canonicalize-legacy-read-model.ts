import { createReadStream } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

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

const scaled = (value: number | undefined): number | undefined =>
  value === undefined ? undefined : value / 100;

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

const loadAuditSnapshots = async (
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
    const rooms = scaled(numberFromRow(document.row, "rooms"));

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

    const adr = scaled(numberFromRow(document.row, "adr"));
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
  const auditSnapshots = await loadAuditSnapshots(options, audits);
  let auditSnapshotsUpserted = 0;
  for (const batch of chunked(auditSnapshots, BATCH_SIZE)) {
    const result = await client.mutation(
      anyApi.legacyBridge.importMutations.upsertLegacyAuditSnapshots,
      { snapshots: batch }
    );
    auditSnapshotsUpserted += Number(result.upserted);
  }
  console.log(`Upserted ${auditSnapshotsUpserted} legacy audit snapshots.`);

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
