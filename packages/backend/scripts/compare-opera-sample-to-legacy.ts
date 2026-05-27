import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";

import { parseAttachment } from "../convex/imports/registry";
import type { ParsedHotelReport } from "../convex/imports/types";

const repoRoot = path.resolve(import.meta.dir, "../../..");
const defaultSampleDir = path.join(
  repoRoot,
  "ref/revparmax-import/fixtures/hiex"
);
const defaultDumpPath = path.join(
  repoRoot,
  "ref/revparmax-import/revparmax_v2-db-24052026.mysql.bz2"
);

const targetCompanyId = 4;
const INSERT_REGEX = /^INSERT INTO `([^`]+)` VALUES (.*);$/;
const TUPLE_REGEX = /\(([^()]*)\)/g;
const FIXTURE_DATE_REGEX = /^(\d{2})(\d{2})(\d{2})$/;

interface LegacyAuditSnapshot {
  auditId: number;
  date: string;
  paces: Array<{ adr: number; date: string; rooms: number }>;
  paymentStats: Record<string, number>;
  revenueStats: Record<string, number>;
  roomStats: Record<string, number>;
}

interface FixtureSet {
  auditDate: string;
  label: string;
  sampleDir: string;
}

const parseSqlFields = (tuple: string): string[] => {
  const fields: string[] = [];
  let current = "";
  let inQuote = false;

  for (const char of tuple) {
    if (char === "'") {
      inQuote = !inQuote;
      continue;
    }
    if (char === "," && !inQuote) {
      fields.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  fields.push(current);
  return fields.map((field) => field.replaceAll("\\'", "'"));
};

const tupleValues = (values: string): string[] => {
  const tuples: string[] = [];
  TUPLE_REGEX.lastIndex = 0;
  let match = TUPLE_REGEX.exec(values);

  while (match) {
    tuples.push(match[1]);
    match = TUPLE_REGEX.exec(values);
  }

  return tuples;
};

const createSnapshot = (
  auditId: number,
  date: string
): LegacyAuditSnapshot => ({
  auditId,
  date,
  paymentStats: {},
  paces: [],
  revenueStats: {},
  roomStats: {},
});

const remapSnapshotKey = (
  values: Record<string, number>,
  oldKey: string,
  newKey: string
) => {
  if (values[oldKey] === undefined) {
    return;
  }

  values[newKey] = values[oldKey];
  delete values[oldKey];
};

const remapExistingStats = (
  snapshotsByDate: Map<string, LegacyAuditSnapshot>,
  statType: "paymentStats" | "revenueStats" | "roomStats",
  oldKey: string,
  newKey: string
) => {
  for (const snapshot of snapshotsByDate.values()) {
    remapSnapshotKey(snapshot[statType], oldKey, newKey);
  }
};

const applyLegacyTuple = (
  snapshotsByAuditId: Map<number, LegacyAuditSnapshot>,
  snapshotsByDate: Map<string, LegacyAuditSnapshot>,
  auditDates: Set<string>,
  tableName: string,
  fields: string[],
  roomCategoryNames: Map<string, string>,
  revenueCategoryNames: Map<string, string>,
  paymentTypeNames: Map<string, string>
) => {
  if (
    tableName === "audits" &&
    Number(fields[2]) === targetCompanyId &&
    auditDates.has(fields[1])
  ) {
    const snapshot = createSnapshot(Number(fields[0]), fields[1]);
    snapshotsByAuditId.set(snapshot.auditId, snapshot);
    snapshotsByDate.set(snapshot.date, snapshot);
    return;
  }

  if (tableName === "room_categories") {
    roomCategoryNames.set(fields[0], fields[1]);
    remapExistingStats(snapshotsByDate, "roomStats", fields[0], fields[1]);
    return;
  }

  if (tableName === "revenue_categories") {
    revenueCategoryNames.set(fields[0], fields[2]);
    remapExistingStats(snapshotsByDate, "revenueStats", fields[0], fields[2]);
    return;
  }

  if (tableName === "payment_types") {
    paymentTypeNames.set(fields[0], fields[1]);
    remapExistingStats(snapshotsByDate, "paymentStats", fields[0], fields[1]);
    return;
  }

  if (tableName === "room_stats") {
    const snapshot = snapshotsByAuditId.get(Number(fields[1]));
    if (!snapshot) {
      return;
    }

    const categoryName = roomCategoryNames.get(fields[2]) ?? fields[2];
    snapshot.roomStats[categoryName] = Number(fields[3]) / 100;
    return;
  }

  if (tableName === "revenue_stats") {
    const snapshot = snapshotsByAuditId.get(Number(fields[1]));
    if (!snapshot) {
      return;
    }

    const categoryName = revenueCategoryNames.get(fields[2]) ?? fields[2];
    snapshot.revenueStats[categoryName] = Number(fields[3]) / 100;
    return;
  }

  if (tableName === "payment_type_stats") {
    const snapshot = snapshotsByAuditId.get(Number(fields[3]));
    if (!snapshot) {
      return;
    }

    const paymentTypeName = paymentTypeNames.get(fields[1]) ?? fields[1];
    snapshot.paymentStats[paymentTypeName] = Number(fields[2]) / 100;
    return;
  }

  if (tableName === "paces") {
    const snapshot = snapshotsByAuditId.get(Number(fields[1]));
    if (!snapshot) {
      return;
    }

    snapshot.paces.push({
      adr: Number(fields[3]) / 100,
      date: fields[2],
      rooms: Number(fields[4]) / 100,
    });
  }
};

const extractLegacySnapshots = async (
  dumpPath: string,
  auditDates: Set<string>
): Promise<Map<string, LegacyAuditSnapshot>> => {
  const roomCategoryNames = new Map<string, string>();
  const revenueCategoryNames = new Map<string, string>();
  const paymentTypeNames = new Map<string, string>();
  const snapshotsByAuditId = new Map<number, LegacyAuditSnapshot>();
  const snapshotsByDate = new Map<string, LegacyAuditSnapshot>();

  const process = spawn("bzcat", [dumpPath], {
    stdio: ["ignore", "pipe", "inherit"],
  });
  const lines = createInterface({ input: process.stdout });

  for await (const line of lines) {
    const insertMatch = line.match(INSERT_REGEX);
    if (!insertMatch) {
      continue;
    }

    const [, tableName, values] = insertMatch;

    for (const tuple of tupleValues(values)) {
      applyLegacyTuple(
        snapshotsByAuditId,
        snapshotsByDate,
        auditDates,
        tableName,
        parseSqlFields(tuple),
        roomCategoryNames,
        revenueCategoryNames,
        paymentTypeNames
      );
    }
  }

  return snapshotsByDate;
};

const fixtureDateFromDirName = (dirName: string): string | undefined => {
  const match = dirName.match(FIXTURE_DATE_REGEX);
  if (!match) {
    return;
  }

  const [, year, month, day] = match;
  return `20${year}-${month}-${day}`;
};

const discoverFixtureSets = async (
  samplePath: string
): Promise<FixtureSet[]> => {
  const entries = await readdir(samplePath, { withFileTypes: true });
  const directXmlFiles = entries.filter(
    (entry) => entry.isFile() && entry.name.endsWith(".xml")
  );

  if (directXmlFiles.length > 0) {
    const reports = await parseOperaSamples(samplePath);
    const auditDate =
      reports.find((report) => report.reportType === "final_audit")
        ?.auditDate ??
      reports
        .find((report) => report.reportType === "occupancy_forecast")
        ?.paceSnapshots?.find((pace) => pace.forecastDate)?.forecastDate;

    if (!auditDate) {
      throw new Error(`Could not infer audit date from ${samplePath}`);
    }

    return [
      { auditDate, label: path.basename(samplePath), sampleDir: samplePath },
    ];
  }

  return entries
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const auditDate = fixtureDateFromDirName(entry.name);
      if (!auditDate) {
        return [];
      }

      return [
        {
          auditDate,
          label: entry.name,
          sampleDir: path.join(samplePath, entry.name),
        },
      ];
    })
    .sort((first, second) => first.auditDate.localeCompare(second.auditDate));
};

const parseOperaSamples = async (
  sampleDir: string
): Promise<ParsedHotelReport[]> => {
  const filenames = (await readdir(sampleDir)).sort((first, second) =>
    first.localeCompare(second, undefined, { numeric: true })
  );
  const reports: ParsedHotelReport[] = [];

  for (const filename of filenames) {
    if (!filename.endsWith(".xml")) {
      continue;
    }

    reports.push(
      parseAttachment({
        content: await readFile(path.join(sampleDir, filename), "utf8"),
        filename,
      })
    );
  }

  return reports;
};

const formatAmount = (value: number | undefined): string =>
  value === undefined ? "missing" : value.toFixed(2);

const resolveInputPath = (inputPath: string | undefined, fallback: string) => {
  if (!inputPath) {
    return fallback;
  }

  return path.isAbsolute(inputPath)
    ? inputPath
    : path.resolve(repoRoot, inputPath);
};

const centsForLabel = (
  lines: ParsedHotelReport["revenue"],
  label: string
): number | undefined =>
  lines?.find((line) => line.sourceLabel === label)?.amount;

const centsForPaymentType = (
  lines: ParsedHotelReport["payments"],
  paymentType: string
): number | undefined =>
  lines?.find((line) => line.paymentType === paymentType.toUpperCase())?.amount;

const dollarsForCents = (amount: number | undefined): number | undefined =>
  amount === undefined ? undefined : amount / 100;

const formatParsedOnlyLines = (
  lines: Array<{ amount: number; label: string }>
): string =>
  lines
    .map(
      (line) => `${line.label}=${formatAmount(dollarsForCents(line.amount))}`
    )
    .join(", ");

const percentDelta = (
  actual: number | undefined,
  expected: number | undefined
): string => {
  if (actual === undefined || expected === undefined || expected === 0) {
    return "n/a";
  }

  return `${(((actual - expected) / expected) * 100).toFixed(2)}%`;
};

const amountsMatch = (
  actual: number | undefined,
  expected: number | undefined
): boolean => actual === expected || (actual === 0 && expected === undefined);

const printScalarComparisons = (
  comparisons: ReadonlyArray<readonly [string, number | undefined]>,
  expectedValues: Record<string, number>
): number => {
  let mismatchCount = 0;

  for (const [label, parsed] of comparisons) {
    const expected = expectedValues[label];
    if (!amountsMatch(parsed, expected)) {
      mismatchCount += 1;
    }
    console.log(
      `${label}: parsed=${formatAmount(parsed)} legacy=${formatAmount(expected)} delta=${percentDelta(parsed, expected)}`
    );
  }

  return mismatchCount;
};

const printPaymentComparisons = (
  legacy: LegacyAuditSnapshot,
  trialBalance: ParsedHotelReport | undefined
): number => {
  const paymentComparisons = Object.keys(legacy.paymentStats).map(
    (paymentType) => {
      const parsed = centsForPaymentType(trialBalance?.payments, paymentType);
      return [paymentType, dollarsForCents(parsed)] as const;
    }
  );

  const mismatchCount = printScalarComparisons(
    paymentComparisons,
    legacy.paymentStats
  );
  const legacyPaymentLabels = new Set(
    Object.keys(legacy.paymentStats).map((label) => label.toUpperCase())
  );
  const parsedOnlyPayments =
    trialBalance?.payments
      ?.filter((payment) => !legacyPaymentLabels.has(payment.paymentType))
      .map((payment) => ({
        amount: payment.amount,
        label: payment.paymentType,
      })) ?? [];

  if (parsedOnlyPayments.length > 0) {
    console.log(
      `Parsed-only payments: ${formatParsedOnlyLines(parsedOnlyPayments)}`
    );
  }

  return mismatchCount;
};

const printPaceComparisons = (
  fixtureSet: FixtureSet,
  legacy: LegacyAuditSnapshot,
  reports: {
    businessOnBooks: ParsedHotelReport | undefined;
    historyForecast: ParsedHotelReport | undefined;
    reservationPace: ParsedHotelReport | undefined;
  }
): number => {
  const paceFor = (report: ParsedHotelReport | undefined) =>
    report?.paceSnapshots?.find(
      (pace) => pace.forecastDate === fixtureSet.auditDate
    );
  const legacyPace = legacy.paces.find(
    (pace) => pace.date === fixtureSet.auditDate
  );
  let mismatchCount = 0;
  const paceComparisons = [
    [
      `history_forecast ${reports.historyForecast?.filename ?? "missing"}`,
      paceFor(reports.historyForecast),
    ],
    [
      `business_on_the_books ${reports.businessOnBooks?.filename ?? "missing"}`,
      paceFor(reports.businessOnBooks),
    ],
    [
      `reservation_pace ${reports.reservationPace?.filename ?? "missing"}`,
      paceFor(reports.reservationPace),
    ],
  ].filter(([, pace]) => pace !== undefined);

  for (const [label, pace] of paceComparisons) {
    const parsedRooms = pace?.roomsOnBooks;
    const parsedAdr = pace?.adr === undefined ? undefined : pace.adr / 100;
    if (!amountsMatch(parsedRooms, legacyPace?.rooms)) {
      mismatchCount += 1;
    }
    if (!amountsMatch(parsedAdr, legacyPace?.adr)) {
      mismatchCount += 1;
    }
    console.log(
      `${label}: rooms=${formatAmount(parsedRooms)} legacy=${formatAmount(legacyPace?.rooms)} delta=${percentDelta(parsedRooms, legacyPace?.rooms)}; adr=${formatAmount(parsedAdr)} legacy=${formatAmount(legacyPace?.adr)} delta=${percentDelta(parsedAdr, legacyPace?.adr)}`
    );
  }

  return mismatchCount;
};

const printFixtureComparison = (
  fixtureSet: FixtureSet,
  legacy: LegacyAuditSnapshot | undefined,
  reports: ParsedHotelReport[]
): number => {
  let mismatchCount = 0;

  const managerReport = reports.find(
    (report) => report.reportType === "hotel_statistics"
  );
  const trialBalance = reports.find(
    (report) => report.reportType === "final_audit"
  );
  const historyForecast = reports.find(
    (report) =>
      report.reportType === "occupancy_forecast" &&
      report.filename.toLowerCase().includes("history_forecast")
  );
  const reservationPace = reports.find(
    (report) =>
      report.reportType === "occupancy_forecast" &&
      report.filename.toLowerCase().includes("reservation_pace")
  );
  const businessOnBooks = reports.find(
    (report) =>
      report.reportType === "occupancy_forecast" &&
      report.filename.toLowerCase().includes("business")
  );

  console.log(
    `\nLegacy audit ${legacy?.auditId ?? "missing"} (${fixtureSet.auditDate}, company ${targetCompanyId}, fixture ${fixtureSet.label})`
  );
  console.log(`Sample directory: ${fixtureSet.sampleDir}`);

  if (!legacy) {
    console.log("Missing legacy audit snapshot.");
    return 1;
  }

  console.log("Room stats");
  const roomComparisons = [
    ["Rooms Occupied", managerReport?.roomStatistics?.roomsOccupied],
    ["No Shows", managerReport?.roomStatistics?.noShows],
    [
      "Early Departure Rooms",
      managerReport?.roomStatistics?.earlyDepartureRooms,
    ],
    [
      "Same Day Cancellations",
      managerReport?.roomStatistics?.sameDayCancellations,
    ],
  ] as const;

  mismatchCount += printScalarComparisons(roomComparisons, legacy.roomStats);

  console.log("\nRevenue stats");
  const revenueComparisons = [
    [
      "Rooms Revenue",
      dollarsForCents(centsForLabel(trialBalance?.revenue, "ROOMS REVENUE")),
    ],
    ["Misc.", dollarsForCents(centsForLabel(trialBalance?.revenue, "MISC."))],
    ["Market", dollarsForCents(centsForLabel(trialBalance?.revenue, "MARKET"))],
  ] as const;

  mismatchCount += printScalarComparisons(
    revenueComparisons,
    legacy.revenueStats
  );

  console.log("\nPayment stats");
  mismatchCount += printPaymentComparisons(legacy, trialBalance);

  console.log("\nPace sources for target date");
  mismatchCount += printPaceComparisons(fixtureSet, legacy, {
    businessOnBooks,
    historyForecast,
    reservationPace,
  });

  return mismatchCount;
};

const main = async () => {
  const dumpPath = resolveInputPath(process.argv[2], defaultDumpPath);
  const samplePath = resolveInputPath(process.argv[3], defaultSampleDir);
  const fixtureSets = await discoverFixtureSets(samplePath);
  const legacySnapshots = await extractLegacySnapshots(
    dumpPath,
    new Set(fixtureSets.map((fixtureSet) => fixtureSet.auditDate))
  );

  let mismatchCount = 0;
  for (const fixtureSet of fixtureSets) {
    mismatchCount += printFixtureComparison(
      fixtureSet,
      legacySnapshots.get(fixtureSet.auditDate),
      await parseOperaSamples(fixtureSet.sampleDir)
    );
  }

  console.log(
    `\nSummary: compared ${fixtureSets.length} fixture sets, mismatches=${mismatchCount}`
  );
};

await main();
