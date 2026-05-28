import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";

const repoRoot = path.resolve(import.meta.dir, "../../..");
const defaultSourceDir = path.join(repoRoot, "tmp/legacy-convex-import");
const defaultOutDir = path.join(
  repoRoot,
  "tmp/legacy-convex-import-filtered-paces"
);
const defaultFromDate = "2024-05-24";
const defaultCompanyIds = new Set([4, 103]);
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

interface Options {
  companyIds: Set<number>;
  fromDate: string;
  maxRows?: number;
  outDir: string;
  sourceDir: string;
}

interface LegacyDocument {
  legacyId?: number;
  row: Record<string, unknown>;
}

const splitCsv = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const printHelp = () => {
  console.log(`
Usage:
  bun scripts/filter-legacy-paces-jsonl.ts [options]

Options:
  --source <path>       Source JSONL directory. Defaults to tmp/legacy-convex-import.
  --out <path>          Output directory. Defaults to tmp/legacy-convex-import-filtered-paces.
  --company-ids <ids>   Comma-separated legacy company IDs. Defaults to 4,103.
  --from-date <date>    Keep audits and paces on or after this YYYY-MM-DD date. Defaults to 2024-05-24.
  --max-rows <n>        Emit at most n pace rows.
`);
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

const parseCompanyIds = (value: string): Set<number> => {
  const ids = splitCsv(value).map((item) => Number(item));

  if (ids.length === 0 || ids.some((id) => !Number.isInteger(id) || id < 1)) {
    throw new Error("--company-ids must contain positive integer IDs");
  }

  return new Set(ids);
};

const assertIsoDate = (optionName: string, value: string): void => {
  if (!ISO_DATE_REGEX.test(value)) {
    throw new Error(`${optionName} must use YYYY-MM-DD format`);
  }
};

const parseArgs = (): Options => {
  const args = process.argv.slice(2);
  const options: Options = {
    companyIds: defaultCompanyIds,
    fromDate: defaultFromDate,
    outDir: defaultOutDir,
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

    if (arg === "--out") {
      options.outDir = path.resolve(repoRoot, requireOptionValue(arg, next));
      index += 1;
      continue;
    }

    if (arg === "--company-ids") {
      options.companyIds = parseCompanyIds(requireOptionValue(arg, next));
      index += 1;
      continue;
    }

    if (arg === "--from-date") {
      options.fromDate = requireOptionValue(arg, next);
      index += 1;
      continue;
    }

    if (arg === "--max-rows") {
      options.maxRows = Number(requireOptionValue(arg, next));
      index += 1;
      continue;
    }

    throw new Error(`Unknown or incomplete option: ${arg}`);
  }

  assertIsoDate("--from-date", options.fromDate);

  if (
    options.maxRows !== undefined &&
    (!Number.isInteger(options.maxRows) || options.maxRows < 1)
  ) {
    throw new Error("--max-rows must be a positive integer");
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

const loadSelectedAuditIds = async (options: Options): Promise<Set<number>> => {
  const auditIds = new Set<number>();
  const auditPath = path.join(
    options.sourceDir,
    "legacyAudits",
    "documents.jsonl"
  );

  for await (const document of readJsonl(auditPath)) {
    const auditId = numberFromRow(document.row, "audit_id");
    const companyId = numberFromRow(document.row, "company_id");
    const auditDate = stringFromRow(document.row, "date");
    const shouldIncludeAudit =
      auditId !== undefined &&
      companyId !== undefined &&
      auditDate !== undefined &&
      options.companyIds.has(companyId) &&
      auditDate >= options.fromDate;

    if (shouldIncludeAudit) {
      auditIds.add(auditId);
    }
  }

  return auditIds;
};

const writeFilteredPaces = async (
  options: Options,
  auditIds: Set<number>
): Promise<number> => {
  const tableDir = path.join(options.outDir, "legacyPaces");
  const pacesPath = path.join(
    options.sourceDir,
    "legacyPaces",
    "documents.jsonl"
  );
  const outPath = path.join(tableDir, "documents.jsonl");
  let rows = 0;

  await rm(options.outDir, { recursive: true, force: true });
  await mkdir(tableDir, { recursive: true });

  const output = createWriteStream(outPath, { encoding: "utf8" });

  try {
    for await (const document of readJsonl(pacesPath)) {
      if (options.maxRows !== undefined && rows >= options.maxRows) {
        break;
      }

      const auditId = numberFromRow(document.row, "audit_id");
      const forDate = stringFromRow(document.row, "for_date");
      const shouldIncludePace =
        auditId !== undefined &&
        forDate !== undefined &&
        auditIds.has(auditId) &&
        forDate >= options.fromDate;

      if (!shouldIncludePace) {
        continue;
      }

      if (!output.write(`${JSON.stringify(document)}\n`)) {
        await new Promise<void>((resolve) => {
          output.once("drain", resolve);
        });
      }
      rows += 1;
    }
  } finally {
    output.end();
    await new Promise<void>((resolve) => {
      output.once("finish", resolve);
    });
  }

  return rows;
};

const writeManifest = async (
  options: Options,
  auditIds: Set<number>,
  rows: number
): Promise<void> => {
  await writeFile(
    path.join(options.outDir, "manifest.json"),
    `${JSON.stringify(
      {
        companyIds: [...options.companyIds].sort(
          (first, second) => first - second
        ),
        fromDate: options.fromDate,
        generatedAt: new Date().toISOString(),
        sourceDir: options.sourceDir,
        tables: [
          {
            auditIds: auditIds.size,
            convexTable: "legacyPaces",
            mysqlTable: "paces",
            rows,
          },
        ],
      },
      null,
      2
    )}\n`
  );
};

const main = async () => {
  const options = parseArgs();
  const auditIds = await loadSelectedAuditIds(options);
  const rows = await writeFilteredPaces(options, auditIds);
  await writeManifest(options, auditIds, rows);

  console.log(
    `Generated ${rows.toLocaleString()} legacyPaces rows from ${auditIds.size.toLocaleString()} audits.`
  );
  console.log(`Output: ${options.outDir}`);
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
