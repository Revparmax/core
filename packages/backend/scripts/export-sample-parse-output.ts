import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseAttachment } from "../convex/imports/registry";
import type {
  ParseContext,
  ParsedHotelReport,
  ValidationResult,
} from "../convex/imports/types";
import {
  summarizeParsedReport,
  validateParsedReport,
} from "../convex/imports/validation/validate";

const repoRoot = path.resolve(import.meta.dir, "../../..");
const sampleRoot = path.join(repoRoot, "ref/revparmax-import");
const defaultOutputPath = path.join(
  "/tmp",
  "revparmax-sample-parser-output.json"
);

const SAMPLE_SETS = [
  {
    context: { expectedAuditDate: "2026-05-15", totalRooms: 127 },
    dir: "hgi-sample-files",
    legacyCompanyId: 103,
    propertyName: "Hilton Garden Inn Oakville",
    systemType: "pep",
  },
  {
    context: { expectedAuditDate: "2026-05-15", totalRooms: 147 },
    dir: "hiex-sample-files",
    legacyCompanyId: 4,
    propertyName: "Holiday Inn Express Riverport",
    systemType: "opera",
  },
] as const satisfies Array<{
  context: ParseContext;
  dir: string;
  legacyCompanyId: number;
  propertyName: string;
  systemType: string;
}>;

interface SampleParseExport {
  legacyCompanyId: number;
  parsed: ParsedHotelReport;
  propertyName: string;
  sampleSet: string;
  sourceFile: string;
  summary: string;
  systemType: string;
  validation: ValidationResult;
}

const main = async () => {
  const outputPath = process.argv[2] ?? defaultOutputPath;
  const exports: SampleParseExport[] = [];

  for (const sampleSet of SAMPLE_SETS) {
    const directory = path.join(sampleRoot, sampleSet.dir);
    const filenames = (await readdir(directory)).sort((first, second) =>
      first.localeCompare(second, undefined, { numeric: true })
    );

    for (const filename of filenames) {
      const filePath = path.join(directory, filename);
      const content = await readFile(filePath, "utf8");
      const report = parseAttachment({ content, filename });
      const validation = validateParsedReport(report, {
        ...sampleSet.context,
        propertyName: sampleSet.propertyName,
      });

      exports.push({
        legacyCompanyId: sampleSet.legacyCompanyId,
        parsed: report,
        propertyName: sampleSet.propertyName,
        sampleSet: sampleSet.dir,
        sourceFile: filename,
        summary: summarizeParsedReport(report),
        systemType: sampleSet.systemType,
        validation,
      });
    }
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(exports, null, 2)}\n`);

  console.log(`Wrote ${exports.length} parsed reports to ${outputPath}`);
};

await main();
