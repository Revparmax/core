import { spawn } from "node:child_process";
import { once } from "node:events";
import { createWriteStream, type WriteStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";

const repoRoot = path.resolve(import.meta.dir, "../../..");
const defaultDumpPath = path.join(
  repoRoot,
  "ref/revparmax-import/backup/revparmax_v2-db-24052026.mysql.bz2"
);
const defaultOutDir = path.join(repoRoot, "tmp/legacy-convex-import");

const INSERT_REGEX = /^INSERT INTO `([^`]+)` VALUES (.*);$/;
const CREATE_TABLE_REGEX = /^CREATE TABLE `([^`]+)` \($/;
const COLUMN_REGEX = /^ {2}`([^`]+)` /;

interface Options {
  dumpPath: string;
  excludedTables: Set<string>;
  maxRowsPerTable?: number;
  outDir: string;
  selectedTables?: Set<string>;
}

interface TableSummary {
  columns: string[];
  convexTable: string;
  legacyIdColumn?: string;
  mysqlTable: string;
  rows: number;
}

interface TableState {
  columns: string[];
  convexTable: string;
  legacyIdColumn?: string;
  rows: number;
  stream?: WriteStream;
}

interface ExportState {
  createTableName?: string;
  tableStates: Map<string, TableState>;
}

interface ParsedOption {
  consumedNext: boolean;
}

const MYSQL_ESCAPE_REPLACEMENTS: Record<string, string> = {
  "0": "\0",
  b: "\b",
  n: "\n",
  r: "\r",
  t: "\t",
  Z: "\u001A",
};

const splitCsv = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const printHelp = () => {
  console.log(`
Usage:
  bun scripts/legacy-mysql-dump-to-convex-jsonl.ts [options]

Options:
  --dump <path>                 MySQL dump path. Defaults to the May 24 backup.
  --out <path>                  Output directory. Defaults to tmp/legacy-convex-import.
  --tables <a,b,c>              Only export these MySQL tables.
  --exclude <a,b,c>             Skip these MySQL tables.
  --max-rows-per-table <n>      Emit at most n rows per exported table.
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

const applyOption = (
  options: Options,
  optionName: string,
  value: string | undefined
): ParsedOption => {
  if (optionName === "--help") {
    printHelp();
    process.exit(0);
  }

  if (optionName === "--dump") {
    options.dumpPath = path.resolve(
      repoRoot,
      requireOptionValue(optionName, value)
    );
    return { consumedNext: true };
  }

  if (optionName === "--out") {
    options.outDir = path.resolve(
      repoRoot,
      requireOptionValue(optionName, value)
    );
    return { consumedNext: true };
  }

  if (optionName === "--tables") {
    options.selectedTables = new Set(
      splitCsv(requireOptionValue(optionName, value))
    );
    return { consumedNext: true };
  }

  if (optionName === "--exclude") {
    options.excludedTables = new Set(
      splitCsv(requireOptionValue(optionName, value))
    );
    return { consumedNext: true };
  }

  if (optionName === "--max-rows-per-table") {
    options.maxRowsPerTable = Number(requireOptionValue(optionName, value));
    return { consumedNext: true };
  }

  throw new Error(`Unknown option: ${optionName}`);
};

const parseArgs = (): Options => {
  const args = process.argv.slice(2);
  const options: Options = {
    dumpPath: defaultDumpPath,
    excludedTables: new Set(),
    outDir: defaultOutDir,
  };

  for (let index = 0; index < args.length; index += 1) {
    const parsed = applyOption(options, args[index], args[index + 1]);
    if (parsed.consumedNext) {
      index += 1;
    }
  }

  if (
    options.maxRowsPerTable !== undefined &&
    (!Number.isInteger(options.maxRowsPerTable) || options.maxRowsPerTable < 1)
  ) {
    throw new Error("--max-rows-per-table must be a positive integer");
  }

  return options;
};

const mysqlTableToConvexTable = (tableName: string): string => {
  const pascalName = tableName
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");

  return `legacy${pascalName}`;
};

const unescapeMysqlString = (value: string): string => {
  let result = "";
  let index = 0;

  while (index < value.length) {
    const char = value[index];

    if (char !== "\\") {
      result += char;
      index += 1;
      continue;
    }

    index += 1;
    const escaped = value[index];

    if (escaped === undefined) {
      result += "\\";
      continue;
    }

    result += MYSQL_ESCAPE_REPLACEMENTS[escaped] ?? escaped;
    index += 1;
  }

  return result;
};

const parseToken = (token: string, quoted: boolean): unknown => {
  if (quoted) {
    return unescapeMysqlString(token);
  }

  const trimmed = token.trim();
  if (trimmed === "NULL" || trimmed === "\\N") {
    return null;
  }

  const numeric = Number(trimmed);
  if (trimmed.length > 0 && Number.isFinite(numeric)) {
    return numeric;
  }

  return trimmed;
};

const parseTupleFields = (tuple: string): unknown[] => {
  const fields: unknown[] = [];
  let current = "";
  let currentQuoted = false;
  let inQuote = false;
  let index = 0;

  while (index < tuple.length) {
    const char = tuple[index];

    if (inQuote && char === "\\") {
      current += char;
      index += 1;
      current += tuple[index] ?? "";
      index += 1;
      continue;
    }

    if (char === "'") {
      inQuote = !inQuote;
      currentQuoted = true;
      index += 1;
      continue;
    }

    if (char === "," && !inQuote) {
      fields.push(parseToken(current, currentQuoted));
      current = "";
      currentQuoted = false;
      index += 1;
      continue;
    }

    current += char;
    index += 1;
  }

  fields.push(parseToken(current, currentQuoted));
  return fields;
};

function* tupleStrings(values: string): Generator<string> {
  let tupleStart = -1;
  let inQuote = false;
  let depth = 0;

  for (let index = 0; index < values.length; index += 1) {
    const char = values[index];

    if (inQuote && char === "\\") {
      index += 1;
      continue;
    }

    if (char === "'") {
      inQuote = !inQuote;
      continue;
    }

    if (inQuote) {
      continue;
    }

    if (char === "(") {
      if (depth === 0) {
        tupleStart = index + 1;
      }
      depth += 1;
      continue;
    }

    if (char === ")") {
      depth -= 1;
      if (depth === 0 && tupleStart >= 0) {
        yield values.slice(tupleStart, index);
        tupleStart = -1;
      }
    }
  }
}

const shouldExportTable = (tableName: string, options: Options): boolean => {
  if (options.excludedTables.has(tableName)) {
    return false;
  }

  return options.selectedTables ? options.selectedTables.has(tableName) : true;
};

const ensureTableStream = async (
  outDir: string,
  tableName: string,
  state: TableState
): Promise<WriteStream> => {
  if (state.stream) {
    return state.stream;
  }

  const tableDir = path.join(outDir, state.convexTable);
  await mkdir(tableDir, { recursive: true });

  state.stream = createWriteStream(path.join(tableDir, "documents.jsonl"), {
    encoding: "utf8",
  });
  console.log(`Writing ${tableName} -> ${state.convexTable}`);

  return state.stream;
};

const writeLine = async (stream: WriteStream, line: string): Promise<void> => {
  if (!stream.write(`${line}\n`)) {
    await once(stream, "drain");
  }
};

const rowFromFields = (
  tableName: string,
  tableState: TableState,
  fields: unknown[]
): Record<string, unknown> => {
  if (fields.length !== tableState.columns.length) {
    throw new Error(
      `${tableName}: expected ${tableState.columns.length} values, got ${fields.length}`
    );
  }

  return Object.fromEntries(
    tableState.columns.map((column, index) => [column, fields[index]])
  );
};

const legacyIdFromRow = (
  row: Record<string, unknown>,
  legacyIdColumn: string | undefined
): number | undefined => {
  if (!legacyIdColumn) {
    return;
  }

  const value = row[legacyIdColumn];
  return typeof value === "number" ? value : undefined;
};

const closeStreams = async (
  tableStates: Map<string, TableState>
): Promise<void> => {
  for (const state of tableStates.values()) {
    if (!state.stream) {
      continue;
    }

    state.stream.end();
    await once(state.stream, "finish");
  }
};

const startCreateTable = (
  exportState: ExportState,
  tableName: string
): void => {
  exportState.createTableName = tableName;
  exportState.tableStates.set(tableName, {
    columns: [],
    convexTable: mysqlTableToConvexTable(tableName),
    rows: 0,
  });
};

const applyCreateTableLine = (
  exportState: ExportState,
  line: string
): boolean => {
  if (!exportState.createTableName) {
    return false;
  }

  const columnMatch = line.match(COLUMN_REGEX);
  if (columnMatch) {
    const state = exportState.tableStates.get(exportState.createTableName);
    state?.columns.push(columnMatch[1]);

    if (state?.legacyIdColumn === undefined && columnMatch[1].endsWith("_id")) {
      state.legacyIdColumn = columnMatch[1];
    }

    return true;
  }

  if (line.startsWith(") ENGINE=")) {
    exportState.createTableName = undefined;
  }

  return true;
};

const writeInsertRows = async (
  options: Options,
  tableName: string,
  values: string,
  tableState: TableState
): Promise<void> => {
  const stream = await ensureTableStream(options.outDir, tableName, tableState);

  for (const tuple of tupleStrings(values)) {
    if (
      options.maxRowsPerTable !== undefined &&
      tableState.rows >= options.maxRowsPerTable
    ) {
      break;
    }

    const row = rowFromFields(tableName, tableState, parseTupleFields(tuple));
    const document = {
      legacyId: legacyIdFromRow(row, tableState.legacyIdColumn),
      row,
    };

    await writeLine(stream, JSON.stringify(document));
    tableState.rows += 1;
  }
};

const applyInsertLine = async (
  options: Options,
  exportState: ExportState,
  line: string
): Promise<boolean> => {
  const insertMatch = line.match(INSERT_REGEX);
  if (!insertMatch) {
    return false;
  }

  const [, tableName, values] = insertMatch;
  if (!shouldExportTable(tableName, options)) {
    return true;
  }

  const tableState = exportState.tableStates.get(tableName);
  if (!tableState) {
    throw new Error(`Missing schema for table ${tableName}`);
  }

  await writeInsertRows(options, tableName, values, tableState);
  return true;
};

const summariesFromState = (
  options: Options,
  tableStates: Map<string, TableState>
): TableSummary[] => {
  const summaries: TableSummary[] = [];

  for (const [mysqlTable, state] of tableStates) {
    if (!shouldExportTable(mysqlTable, options) || state.rows === 0) {
      continue;
    }

    summaries.push({
      columns: state.columns,
      convexTable: state.convexTable,
      legacyIdColumn: state.legacyIdColumn,
      mysqlTable,
      rows: state.rows,
    });
  }

  return summaries;
};

const exportDump = async (options: Options): Promise<TableSummary[]> => {
  await rm(options.outDir, { recursive: true, force: true });
  await mkdir(options.outDir, { recursive: true });

  const exportState: ExportState = {
    tableStates: new Map<string, TableState>(),
  };

  const dumpProcess = spawn("bzcat", [options.dumpPath], {
    stdio: ["ignore", "pipe", "inherit"],
  });
  const exitCodePromise = new Promise<number | null>((resolve) => {
    dumpProcess.on("close", resolve);
  });
  const lines = createInterface({ input: dumpProcess.stdout });

  for await (const line of lines) {
    const createMatch = line.match(CREATE_TABLE_REGEX);
    if (createMatch) {
      startCreateTable(exportState, createMatch[1]);
      continue;
    }

    if (applyCreateTableLine(exportState, line)) {
      continue;
    }

    await applyInsertLine(options, exportState, line);
  }

  const exitCode = await exitCodePromise;
  if (exitCode !== 0) {
    throw new Error(`bzcat exited with code ${exitCode}`);
  }

  await closeStreams(exportState.tableStates);
  const summaries = summariesFromState(options, exportState.tableStates);

  await writeFile(
    path.join(options.outDir, "manifest.json"),
    `${JSON.stringify(
      {
        dumpPath: options.dumpPath,
        generatedAt: new Date().toISOString(),
        tables: summaries,
      },
      null,
      2
    )}\n`
  );

  return summaries;
};

const main = async () => {
  const options = parseArgs();
  const summaries = await exportDump(options);
  const totalRows = summaries.reduce((total, table) => total + table.rows, 0);

  console.log(`\nGenerated ${totalRows.toLocaleString()} documents.`);
  console.table(
    summaries.map((summary) => ({
      table: summary.mysqlTable,
      convexTable: summary.convexTable,
      rows: summary.rows,
    }))
  );
  console.log(`\nOutput: ${options.outDir}`);
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
