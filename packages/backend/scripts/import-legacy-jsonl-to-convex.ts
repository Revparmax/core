import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dir, "../../..");
const defaultImportDir = path.join(repoRoot, "tmp/legacy-convex-import");

interface Manifest {
  tables: Array<{
    convexTable: string;
    rows: number;
  }>;
}

interface Options {
  append: boolean;
  excludedTables: Set<string>;
  importDir: string;
  selectedTables?: Set<string>;
}

const printHelp = () => {
  console.log(`
Usage:
  bun scripts/import-legacy-jsonl-to-convex.ts [options]

Options:
  --dir <path>       Import directory. Defaults to tmp/legacy-convex-import.
  --tables <a,b,c>   Only import these Convex table names.
  --exclude <a,b,c>  Skip these Convex table names.
  --append           Append instead of replacing each imported table.

Requires a running Convex dev deployment. For local Convex:
  bun run dev
`);
};

const parseArgs = (): Options => {
  const args = process.argv.slice(2);
  const options: Options = {
    append: false,
    excludedTables: new Set(),
    importDir: defaultImportDir,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--dir" && next) {
      options.importDir = path.resolve(repoRoot, next);
      index += 1;
      continue;
    }

    if (arg === "--tables" && next) {
      options.selectedTables = new Set(
        next
          .split(",")
          .map((table) => table.trim())
          .filter((table) => table.length > 0)
      );
      index += 1;
      continue;
    }

    if (arg === "--exclude" && next) {
      options.excludedTables = new Set(
        next
          .split(",")
          .map((table) => table.trim())
          .filter((table) => table.length > 0)
      );
      index += 1;
      continue;
    }

    if (arg === "--append") {
      options.append = true;
      continue;
    }

    if (arg === "--help") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown or incomplete option: ${arg}`);
  }

  return options;
};

const loadTables = async (importDir: string): Promise<Manifest["tables"]> => {
  try {
    const manifest = JSON.parse(
      await readFile(path.join(importDir, "manifest.json"), "utf8")
    ) as Manifest;
    return manifest.tables;
  } catch (error) {
    const entries = await readdir(importDir, { withFileTypes: true });
    const tables = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        convexTable: entry.name,
        rows: 1,
      }))
      .sort((first, second) =>
        first.convexTable.localeCompare(second.convexTable)
      );

    if (tables.length === 0) {
      throw error;
    }

    console.warn(
      `No manifest.json found in ${importDir}; importing discovered table directories.`
    );
    return tables;
  }
};

const runConvexImport = async (
  importDir: string,
  tableName: string,
  append: boolean
): Promise<void> => {
  const documentsPath = path.join(importDir, tableName, "documents.jsonl");
  const args = [
    "convex",
    "import",
    append ? "--append" : "--replace",
    "--table",
    tableName,
    "--format",
    "jsonLines",
    "-y",
    documentsPath,
  ];

  console.log(`Importing ${tableName}`);

  const child = spawn("bunx", args, {
    cwd: path.join(repoRoot, "packages/backend"),
    stdio: "inherit",
  });

  const exitCode = await new Promise<number | null>((resolve) => {
    child.on("close", resolve);
  });

  if (exitCode !== 0) {
    throw new Error(
      `Convex import failed for ${tableName} with code ${exitCode}`
    );
  }
};

const main = async () => {
  const options = parseArgs();
  const tables = (await loadTables(options.importDir)).filter(
    (table) =>
      table.rows > 0 &&
      !options.excludedTables.has(table.convexTable) &&
      (!options.selectedTables || options.selectedTables.has(table.convexTable))
  );

  for (const table of tables) {
    await runConvexImport(options.importDir, table.convexTable, options.append);
  }

  console.log(`Imported ${tables.length} legacy tables into Convex.`);
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
