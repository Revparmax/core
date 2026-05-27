import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";

import { parseAttachment } from "../convex/imports/registry";
import type { ParsedHotelReport } from "../convex/imports/types";

const repoRoot = path.resolve(import.meta.dir, "../../..");
const sampleDir = path.join(repoRoot, "ref/revparmax-import/hiex-sample-files");
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
  revenueCategoryNames: Map<string, string>
) => {
  if (tableName === "room_categories") {
    roomCategoryNames.set(fields[0], fields[1]);
    return;
  }

  if (tableName === "revenue_categories") {
    revenueCategoryNames.set(fields[0], fields[2]);
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
  const snapshot: LegacyAuditSnapshot = {
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
        revenueCategoryNames
      );
    }
  }

  return snapshot;
};

const parseOperaSamples = async (): Promise<ParsedHotelReport[]> => {
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
  const dumpPath = process.argv[2] ?? defaultDumpPath;
  const [legacy, reports] = await Promise.all([
    extractLegacySnapshot(dumpPath),
    parseOperaSamples(),
  ]);

  const managerReport = reports.find(
    (report) => report.reportType === "hotel_statistics"
  );
  const historyForecast = reports.find((report) => report.filename === "5.xml");
  const reservationPace = reports.find(
    (report) => report.filename === "10.xml"
  );
  const businessOnBooks = reports.find((report) => report.filename === "9.xml");

  const paceFor = (report: ParsedHotelReport | undefined) =>
    report?.paceSnapshots?.find((pace) => pace.forecastDate === targetDate);
  const legacyPace = legacy.paces.find((pace) => pace.date === targetDate);

  console.log(`Legacy audit ${auditId} (${targetDate}, company 4)`);
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
  const roomRevenue = managerReport?.revenue?.find(
    (line) => line.sourceLabel === "ROOM REVENUE"
  )?.amount;
  const otherRevenue = managerReport?.revenue?.find(
    (line) => line.sourceLabel === "OTHER REVENUE"
  )?.amount;
  const revenueComparisons = [
    [
      "Rooms Revenue",
      roomRevenue === undefined ? undefined : roomRevenue / 100,
    ],
    ["Misc.", otherRevenue === undefined ? undefined : otherRevenue / 100],
  ] as const;

  for (const [label, parsed] of revenueComparisons) {
    const expected = legacy.revenueStats[label];
    console.log(
      `${label}: parsed=${formatAmount(parsed)} legacy=${formatAmount(expected)} delta=${percentDelta(parsed, expected)}`
    );
  }

  console.log("\nPace sources for target date");
  const paceComparisons = [
    ["history_forecast sample 5.xml", paceFor(historyForecast)],
    ["business_on_the_books sample 9.xml", paceFor(businessOnBooks)],
    ["reservation_pace sample 10.xml", paceFor(reservationPace)],
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
