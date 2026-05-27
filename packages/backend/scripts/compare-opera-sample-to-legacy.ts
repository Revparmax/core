import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";

import { parseAttachment } from "../convex/imports/registry";
import type { ParsedHotelReport } from "../convex/imports/types";

const repoRoot = path.resolve(import.meta.dir, "../../..");
const defaultSampleDir = path.join(
  repoRoot,
  "ref/revparmax-import/hiex-sample-files"
);
const defaultDumpPath = path.join(
  repoRoot,
  "ref/revparmax-import/revparmax_v2-db-24052026.mysql.bz2"
);

const auditId = 20_252;
const targetDate = "2026-05-15";
const INSERT_REGEX = /^INSERT INTO `([^`]+)` VALUES (.*);$/;
const TUPLE_REGEX = /\(([^()]*)\)/g;

interface LegacyAuditSnapshot {
  paces: Array<{ adr: number; date: string; rooms: number }>;
  paymentStats: Record<string, number>;
  revenueStats: Record<string, number>;
  roomStats: Record<string, number>;
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

const applyLegacyTuple = (
  snapshot: LegacyAuditSnapshot,
  tableName: string,
  fields: string[],
  roomCategoryNames: Map<string, string>,
  revenueCategoryNames: Map<string, string>,
  paymentTypeNames: Map<string, string>
) => {
  if (tableName === "room_categories") {
    roomCategoryNames.set(fields[0], fields[1]);
    return;
  }

  if (tableName === "revenue_categories") {
    revenueCategoryNames.set(fields[0], fields[2]);
    return;
  }

  if (tableName === "payment_types") {
    paymentTypeNames.set(fields[0], fields[1]);
    if (snapshot.paymentStats[fields[0]] !== undefined) {
      snapshot.paymentStats[fields[1]] = snapshot.paymentStats[fields[0]];
      delete snapshot.paymentStats[fields[0]];
    }
    return;
  }

  if (tableName === "room_stats" && Number(fields[1]) === auditId) {
    const categoryName = roomCategoryNames.get(fields[2]) ?? fields[2];
    snapshot.roomStats[categoryName] = Number(fields[3]) / 100;
    return;
  }

  if (tableName === "revenue_stats" && Number(fields[1]) === auditId) {
    const categoryName = revenueCategoryNames.get(fields[2]) ?? fields[2];
    snapshot.revenueStats[categoryName] = Number(fields[3]) / 100;
    return;
  }

  if (tableName === "payment_type_stats" && Number(fields[3]) === auditId) {
    const paymentTypeName = paymentTypeNames.get(fields[1]) ?? fields[1];
    snapshot.paymentStats[paymentTypeName] = Number(fields[2]) / 100;
    return;
  }

  if (tableName === "paces" && Number(fields[1]) === auditId) {
    snapshot.paces.push({
      adr: Number(fields[3]) / 100,
      date: fields[2],
      rooms: Number(fields[4]) / 100,
    });
  }
};

const extractLegacySnapshot = async (
  dumpPath: string
): Promise<LegacyAuditSnapshot> => {
  const roomCategoryNames = new Map<string, string>();
  const revenueCategoryNames = new Map<string, string>();
  const paymentTypeNames = new Map<string, string>();
  const snapshot: LegacyAuditSnapshot = {
    paymentStats: {},
    paces: [],
    revenueStats: {},
    roomStats: {},
  };

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
        snapshot,
        tableName,
        parseSqlFields(tuple),
        roomCategoryNames,
        revenueCategoryNames,
        paymentTypeNames
      );
    }
  }

  return snapshot;
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

const main = async () => {
  const dumpPath = resolveInputPath(process.argv[2], defaultDumpPath);
  const sampleDir = resolveInputPath(process.argv[3], defaultSampleDir);
  const [legacy, reports] = await Promise.all([
    extractLegacySnapshot(dumpPath),
    parseOperaSamples(sampleDir),
  ]);

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

  const paceFor = (report: ParsedHotelReport | undefined) =>
    report?.paceSnapshots?.find((pace) => pace.forecastDate === targetDate);
  const legacyPace = legacy.paces.find((pace) => pace.date === targetDate);

  console.log(`Legacy audit ${auditId} (${targetDate}, company 4)`);
  console.log(`Sample directory: ${sampleDir}`);
  console.log("\nRoom stats");
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

  for (const [label, parsed] of roomComparisons) {
    const expected = legacy.roomStats[label];
    console.log(
      `${label}: parsed=${formatAmount(parsed)} legacy=${formatAmount(expected)} delta=${percentDelta(parsed, expected)}`
    );
  }

  console.log("\nRevenue stats");
  const revenueComparisons = [
    [
      "Rooms Revenue",
      dollarsForCents(centsForLabel(trialBalance?.revenue, "ROOMS REVENUE")),
    ],
    ["Misc.", dollarsForCents(centsForLabel(trialBalance?.revenue, "MISC."))],
    ["Market", dollarsForCents(centsForLabel(trialBalance?.revenue, "MARKET"))],
  ] as const;

  for (const [label, parsed] of revenueComparisons) {
    const expected = legacy.revenueStats[label];
    console.log(
      `${label}: parsed=${formatAmount(parsed)} legacy=${formatAmount(expected)} delta=${percentDelta(parsed, expected)}`
    );
  }

  console.log("\nPayment stats");
  const paymentComparisons = Object.keys(legacy.paymentStats).map(
    (paymentType) => {
      const parsed = centsForPaymentType(trialBalance?.payments, paymentType);
      return [paymentType, dollarsForCents(parsed)] as const;
    }
  );

  for (const [label, parsed] of paymentComparisons) {
    const expected = legacy.paymentStats[label];
    console.log(
      `${label}: parsed=${formatAmount(parsed)} legacy=${formatAmount(expected)} delta=${percentDelta(parsed, expected)}`
    );
  }

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

  console.log("\nPace sources for target date");
  const paceComparisons = [
    [
      `history_forecast ${historyForecast?.filename ?? "missing"}`,
      paceFor(historyForecast),
    ],
    [
      `business_on_the_books ${businessOnBooks?.filename ?? "missing"}`,
      paceFor(businessOnBooks),
    ],
    [
      `reservation_pace ${reservationPace?.filename ?? "missing"}`,
      paceFor(reservationPace),
    ],
  ] as const;

  for (const [label, pace] of paceComparisons) {
    const parsedRooms = pace?.roomsOnBooks;
    const parsedAdr = pace?.adr === undefined ? undefined : pace.adr / 100;
    console.log(
      `${label}: rooms=${formatAmount(parsedRooms)} legacy=${formatAmount(legacyPace?.rooms)} delta=${percentDelta(parsedRooms, legacyPace?.rooms)}; adr=${formatAmount(parsedAdr)} legacy=${formatAmount(legacyPace?.adr)} delta=${percentDelta(parsedAdr, legacyPace?.adr)}`
    );
  }
};

await main();
