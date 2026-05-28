import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { parseAttachment } from "../convex/imports/registry";
import type { ParseContext } from "../convex/imports/types";
import {
  summarizeParsedReport,
  validateParsedReport,
} from "../convex/imports/validation/validate";

const repoRoot = path.resolve(import.meta.dir, "../../..");
const sampleRoot = path.join(repoRoot, "ref/revparmax-import");

const SAMPLE_SETS = [
  {
    context: { propertyName: "Hilton Garden Inn", totalRooms: 127 },
    dir: "hgi-sample-files",
  },
  {
    context: { propertyName: "Holiday Inn Express", totalRooms: 147 },
    dir: "hiex-sample-files",
  },
] as const satisfies Array<{ context: ParseContext; dir: string }>;

const main = async () => {
  let errorCount = 0;
  let warningCount = 0;

  for (const sampleSet of SAMPLE_SETS) {
    const directory = path.join(sampleRoot, sampleSet.dir);
    const filenames = (await readdir(directory)).sort((first, second) =>
      first.localeCompare(second, undefined, { numeric: true })
    );

    console.log(`\n${sampleSet.dir}`);

    for (const filename of filenames) {
      const filePath = path.join(directory, filename);
      const content = await readFile(filePath, "utf8");
      const report = parseAttachment({
        content,
        filename,
      });
      const validation = validateParsedReport(report, sampleSet.context);

      errorCount += validation.errors.length;
      warningCount += validation.warnings.length;

      const status = validation.isValid ? "ok" : "error";
      console.log(`  ${status} ${summarizeParsedReport(report)}`);

      for (const validationError of validation.errors) {
        console.log(
          `    error ${validationError.code}: ${validationError.message}`
        );
      }
      for (const validationWarning of validation.warnings) {
        console.log(
          `    warning ${validationWarning.code}: ${validationWarning.message}`
        );
      }
    }
  }

  console.log(
    `\nValidation totals: ${errorCount} errors, ${warningCount} warnings`
  );

  if (errorCount > 0) {
    process.exitCode = 1;
  }
};

await main();
