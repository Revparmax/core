import { hasColumns, parseCsvRows, rowToObject } from "../csv";
import type {
  IdentifiedReport,
  ImportAttachment,
  ParsedHotelReport,
  ParserProfile,
  ReportType,
} from "../types";
import {
  calculateAdr,
  normalizeHeader,
  normalizeLabel,
  parseCurrency,
  parseNumber,
  parsePmsDate,
} from "../utils";
import { splitPepCsvTables } from "./csvTables";

export const PEP_DEFAULT_PROFILE: ParserProfile = {
  id: "pep.default",
  isDefault: true,
  label: "PEP / Hilton OnQ default CSV reports",
  systemType: "pep",
};

const HEADER_REPORT_TYPES: Array<{
  columns: string[];
  reportType: ReportType;
  signature: string;
}> = [
  {
    columns: ["description", "actual_today", "m_t_d"],
    reportType: "hotel_statistics",
    signature: "description.actual_today.mtd",
  },
  {
    columns: ["date", "day_of_week", "total_sold_rooms", "total_revenue"],
    reportType: "occupancy_forecast",
    signature: "date.day.total_sold_rooms",
  },
  {
    columns: ["date", "market_segment", "market_segment_code"],
    reportType: "market_segment",
    signature: "date.market_segment.code",
  },
  {
    columns: ["date", "total_inventory", "room_type_code"],
    reportType: "room_availability",
    signature: "date.total_inventory.room_type_code",
  },
  {
    columns: ["booking_date", "confirmation_number", "arrival_date"],
    reportType: "booked_reservations",
    signature: "booking.confirmation.arrival",
  },
  {
    columns: ["cancellation_date", "cancellation_time", "confirmation_number"],
    reportType: "cancelled_reservations",
    signature: "cancellation.confirmation",
  },
  {
    columns: ["group_name", "group_code", "reserved_rooms"],
    reportType: "group_reservations",
    signature: "group.group_code.reserved",
  },
  {
    columns: ["confirmation_no", "reservation_status", "payment_status"],
    reportType: "no_show_late_cancel",
    signature: "confirmation_no.reservation_status",
  },
  {
    columns: ["confirmation_number", "guest_name", "net_change"],
    reportType: "guest_ledger",
    signature: "confirmation_number.guest_name.net_change",
  },
  {
    columns: ["charge_type", "actual_today", "net_today"],
    reportType: "final_audit",
    signature: "charge_type.net_today",
  },
  {
    columns: ["date", "confirmation_number", "payment_type", "amount"],
    reportType: "payment_transactions",
    signature: "date.payment_type.amount",
  },
  {
    columns: ["account_type", "company_name", "current", "total"],
    reportType: "ar_invoice_aging",
    signature: "account_type.company.current.total",
  },
  {
    columns: ["payment_method", "opening_balance", "closing_balance"],
    reportType: "advance_deposit",
    signature: "payment_method.opening_balance",
  },
  {
    columns: ["transaction_description", "transaction_type", "amount"],
    reportType: "all_transactions",
    signature: "transaction_description.type.amount",
  },
  {
    columns: ["room_number", "maintenance_type", "reason"],
    reportType: "maintenance",
    signature: "room_number.maintenance_type",
  },
];

const REPORT_TYPES_WITH_DEFERRED_OUTPUT = new Set<ReportType>([
  "advance_deposit",
  "all_transactions",
  "ar_invoice_aging",
  "guest_ledger",
  "maintenance",
]);

export const identifyPepReport = (
  attachment: ImportAttachment
): IdentifiedReport | undefined => {
  const extensionMatch = attachment.filename.toLowerCase().endsWith(".csv");
  const mimeMatch =
    attachment.contentType === "text/csv" ||
    attachment.contentType === "application/vnd.ms-excel";

  if (!(extensionMatch || mimeMatch)) {
    return;
  }

  const rows = parseCsvRows(attachment.content);
  const firstNonBlankRow = rows.find((row) =>
    row.some((cell) => cell.trim() !== "")
  );

  if (!firstNonBlankRow) {
    return {
      confidence: 0,
      profile: PEP_DEFAULT_PROFILE,
      reportType: "unknown",
      signature: "empty_csv",
    };
  }

  for (const fingerprint of HEADER_REPORT_TYPES) {
    if (hasColumns(firstNonBlankRow, fingerprint.columns)) {
      return {
        confidence: 0.95,
        profile: PEP_DEFAULT_PROFILE,
        reportType: fingerprint.reportType,
        signature: fingerprint.signature,
      };
    }
  }

  return {
    confidence: 0.25,
    profile: PEP_DEFAULT_PROFILE,
    reportType: "unknown",
    signature: firstNonBlankRow.map(normalizeHeader).join("."),
  };
};

export const parsePepReport = (
  attachment: ImportAttachment,
  identified: IdentifiedReport
): ParsedHotelReport => {
  const rows = parseCsvRows(attachment.content);
  const tables = splitPepCsvTables(rows);
  const warnings: string[] = [];

  const base: ParsedHotelReport = {
    confidence: identified.confidence,
    filename: attachment.filename,
    profileId: identified.profile.id,
    reportType: identified.reportType,
    rowCount: rows.length,
    systemType: "pep",
    warnings,
  };

  switch (identified.reportType) {
    case "hotel_statistics":
      return { ...base, ...parseHotelStatisticsTables(tables, warnings) };
    case "occupancy_forecast":
      return { ...base, ...parseOccupancyForecastTable(tables[0], warnings) };
    case "market_segment":
      return { ...base, ...parseMarketSegmentTable(tables[0], warnings) };
    case "room_availability":
      return { ...base, ...parseRoomAvailabilityTable(tables[0], warnings) };
    case "booked_reservations":
      return { ...base, ...parseBookedReservationsTable(tables[0], warnings) };
    case "cancelled_reservations":
      return {
        ...base,
        ...parseCancelledReservationsTable(tables[0], warnings),
      };
    case "group_reservations":
      return { ...base, ...parseGroupReservationsTable(tables[0], warnings) };
    case "no_show_late_cancel":
      return { ...base, bookedReservations: [] };
    case "final_audit":
      return { ...base, ...parseFinalAuditTable(tables[0], warnings) };
    case "payment_transactions":
      return { ...base, ...parsePaymentTransactionsTable(tables[0], warnings) };
    default:
      if (REPORT_TYPES_WITH_DEFERRED_OUTPUT.has(identified.reportType)) {
        warnings.push(
          `${identified.reportType} is identified but does not yet have a normalized Convex target shape.`
        );
      }
      return base;
  }
};

const actualToday = (row: Record<string, string>): string =>
  row.actual_today ?? row.amount ?? "";

const parseHotelStatisticsTables = (
  tables: ReturnType<typeof splitPepCsvTables>,
  warnings: string[]
): Partial<ParsedHotelReport> => {
  const roomStatistics: NonNullable<ParsedHotelReport["roomStatistics"]> = {};
  const revenue: NonNullable<ParsedHotelReport["revenue"]> = [];
  const payments: NonNullable<ParsedHotelReport["payments"]> = [];

  for (const table of tables) {
    const objects = table.rows.map((row) => rowToObject(table.header, row));
    const labels = new Set(
      objects.map((row) => normalizeLabel(row.description))
    );

    applyHotelStatisticsTable(objects, labels, {
      payments,
      revenue,
      roomStatistics,
    });
  }

  if (Object.keys(roomStatistics).length === 0) {
    warnings.push("No room statistic rows were found in Hotel Statistics.");
  }

  return { payments, revenue, roomStatistics };
};

interface HotelStatisticsAccumulator {
  payments: NonNullable<ParsedHotelReport["payments"]>;
  revenue: NonNullable<ParsedHotelReport["revenue"]>;
  roomStatistics: NonNullable<ParsedHotelReport["roomStatistics"]>;
}

const applyHotelStatisticsTable = (
  objects: Record<string, string>[],
  labels: Set<string>,
  accumulator: HotelStatisticsAccumulator
) => {
  if (labels.has("ROOM SOLD")) {
    applyRoomStatisticRows(objects, accumulator.roomStatistics);
    return;
  }

  if ([...labels].some((label) => label.startsWith("ADR "))) {
    applyAdrRows(objects, accumulator.roomStatistics);
    return;
  }

  if (labels.has("NO SHOWS")) {
    applyNoShowRows(objects, accumulator.roomStatistics);
    return;
  }

  if (labels.has("CASH") || labels.has("VISA") || labels.has("MASTER")) {
    accumulator.payments.push(...extractPaymentRows(objects));
    return;
  }

  if (labels.has("TAXABLE ROOM REVENUE")) {
    accumulator.revenue.push(...extractRevenueRows(objects));
  }
};

const applyRoomStatisticRows = (
  objects: Record<string, string>[],
  roomStatistics: NonNullable<ParsedHotelReport["roomStatistics"]>
) => {
  for (const row of objects) {
    const label = normalizeLabel(row.description);
    const value = parseNumber(actualToday(row));

    if (label === "TOTAL ROOMS") {
      roomStatistics.totalRooms = value;
    } else if (label === "ROOM SOLD") {
      roomStatistics.roomsOccupied = value;
    } else if (label === "COMP ROOMS") {
      roomStatistics.compRooms = value;
    } else if (label === "OUT OF ORDER") {
      roomStatistics.oooRooms = value;
    } else if (label === "SAME DAY CHECKOUT") {
      roomStatistics.sameDayCancellations = value;
    }
  }
};

const applyAdrRows = (
  objects: Record<string, string>[],
  roomStatistics: NonNullable<ParsedHotelReport["roomStatistics"]>
) => {
  const adrRow = objects.find((row) =>
    normalizeLabel(row.description).startsWith("ADR INCLUDING")
  );

  if (adrRow) {
    roomStatistics.adr = parseCurrency(actualToday(adrRow));
  }
};

const applyNoShowRows = (
  objects: Record<string, string>[],
  roomStatistics: NonNullable<ParsedHotelReport["roomStatistics"]>
) => {
  const noShowsRow = objects.find(
    (row) => normalizeLabel(row.description) === "NO SHOWS"
  );

  if (noShowsRow) {
    roomStatistics.noShows = parseNumber(actualToday(noShowsRow));
  }
};

const extractPaymentRows = (
  objects: Record<string, string>[]
): NonNullable<ParsedHotelReport["payments"]> =>
  objects
    .filter((row) => row.description.trim() !== "")
    .map((row) => ({
      amount: parseCurrency(actualToday(row)),
      paymentType: normalizeLabel(row.description),
    }));

const extractRevenueRows = (
  objects: Record<string, string>[]
): NonNullable<ParsedHotelReport["revenue"]> =>
  objects
    .filter((row) => row.description.trim() !== "")
    .map((row) => ({
      amount: parseCurrency(actualToday(row)),
      sourceLabel: normalizeLabel(row.description),
    }));

const parseOccupancyForecastTable = (
  table: ReturnType<typeof splitPepCsvTables>[number] | undefined,
  warnings: string[]
): Partial<ParsedHotelReport> => {
  if (!table) {
    warnings.push("Missing occupancy forecast table.");
    return { paceSnapshots: [] };
  }

  const paceSnapshots = table.rows
    .map((row) => rowToObject(table.header, row))
    .filter((object) => parsePmsDate(object.date))
    .map((object) => {
      const forecastDate = parsePmsDate(object.date) ?? "";
      const totalRevenue = parseCurrency(object.total_revenue);
      const roomsOnBooks = parseNumber(object.total_sold_rooms);
      return {
        adr: calculateAdr(totalRevenue, roomsOnBooks),
        arrivals: parseNumber(object.arrivals),
        availableRooms: parseNumber(object.available_rooms),
        departures: parseNumber(object.departures),
        forecastDate,
        roomsOnBooks,
        totalRevenue,
      };
    });

  return {
    auditDate: paceSnapshots[0]?.forecastDate,
    paceSnapshots,
  };
};

const parseMarketSegmentTable = (
  table: ReturnType<typeof splitPepCsvTables>[number] | undefined,
  warnings: string[]
): Partial<ParsedHotelReport> => {
  if (!table) {
    warnings.push("Missing market segment table.");
    return { marketSegments: [] };
  }

  const marketSegments = table.rows
    .map((row) => rowToObject(table.header, row))
    .filter((object) => object.market_segment || object.market_segment_code)
    .map((object) => ({
      adr: parseCurrency(object.adr),
      adults: parseNumber(object.adult_s),
      children: parseNumber(object.children),
      occupancyContribution: parseNumber(object.occupancy_contribution),
      revparContribution: parseCurrency(object.revpar_contribution),
      roomRevenue: parseCurrency(object.room_revenue),
      segmentCode: object.market_segment_code,
      segmentName: object.market_segment,
      stays: parseNumber(object.stays),
      totalRevenue: parseCurrency(object.total_revenue),
    }));

  return {
    auditDate: parsePmsDate(
      rowToObject(table.header, table.rows[0] ?? []).date
    ),
    marketSegments,
  };
};

const parseRoomAvailabilityTable = (
  table: ReturnType<typeof splitPepCsvTables>[number] | undefined,
  warnings: string[]
): Partial<ParsedHotelReport> => {
  if (!table) {
    warnings.push("Missing room availability table.");
    return { roomTypeAvailability: [] };
  }

  const roomTypeAvailability = table.rows
    .map((row) => rowToObject(table.header, row))
    .filter((object) => object.room_type_code)
    .map((object) => ({
      available: parseNumber(object.available),
      roomTypeCode: object.room_type_code,
      roomTypeName: object.room_type_name,
      sold: parseNumber(object.sold),
      totalInventory: parseNumber(object.total_inventory),
    }));

  return {
    auditDate: parsePmsDate(
      rowToObject(table.header, table.rows[0] ?? []).date
    ),
    roomTypeAvailability,
  };
};

const parseBookedReservationsTable = (
  table: ReturnType<typeof splitPepCsvTables>[number] | undefined,
  warnings: string[]
): Partial<ParsedHotelReport> => {
  if (!table) {
    warnings.push("Missing booked reservations table.");
    return { bookedReservations: [] };
  }

  const bookedReservations = table.rows
    .map((row) => rowToObject(table.header, row))
    .filter((object) => object.confirmation_number || object.guest_name)
    .map((object) => ({
      adr: parseCurrency(object.adr),
      arrivalDate: parsePmsDate(object.arrival_date) ?? "",
      bookingDate: parsePmsDate(object.booking_date),
      companyName: object.company_name,
      confirmationNumber: object.confirmation_number,
      departureDate: parsePmsDate(object.departure_date) ?? "",
      guestName: object.guest_name,
      marketSegment: object.market_segment,
      nights: parseNumber(object.nights),
      ratePlan: object.rate_plan,
      roomType: object.room_type,
      source: object.source,
      totalRoomRate: parseCurrency(object.total_room_rate),
    }));

  return {
    auditDate: bookedReservations[0]?.bookingDate,
    bookedReservations,
  };
};

const parseCancelledReservationsTable = (
  table: ReturnType<typeof splitPepCsvTables>[number] | undefined,
  warnings: string[]
): Partial<ParsedHotelReport> => {
  if (!table) {
    warnings.push("Missing cancelled reservations table.");
    return { cancelledReservations: [] };
  }

  const cancelledReservations = table.rows.map((row) => {
    const object = rowToObject(table.header, row);
    return {
      arrivalDate: parsePmsDate(object.arrival_date),
      cancellationDate: parsePmsDate(object.cancellation_date),
      cancellationNumber: object.cancellation_number,
      confirmationNumber: object.confirmation_number,
      guestName: object.guest_name,
      nights: parseNumber(object.number_of_nights),
      ratePlan: object.rate_plan,
      roomType: object.room_type,
      source: object.source,
    };
  });

  return {
    auditDate: cancelledReservations[0]?.cancellationDate,
    cancelledReservations,
  };
};

const parseGroupReservationsTable = (
  table: ReturnType<typeof splitPepCsvTables>[number] | undefined,
  warnings: string[]
): Partial<ParsedHotelReport> => {
  if (!table) {
    warnings.push("Missing group reservations table.");
    return { groupBlocks: [] };
  }

  const groupBlocks = table.rows
    .map((row) => rowToObject(table.header, row))
    .filter((object) => object.group_name || object.group_code)
    .map((object) => ({
      availableForPickup: parseNumber(object.available_for_pick_up),
      checkinDate: parsePmsDate(object.check_in_date),
      checkoutDate: parsePmsDate(object.check_out_date),
      groupCode: object.group_code,
      groupName: object.group_name,
      ratePlan: object.rate_plan,
      releasedRooms: parseNumber(object.released_rooms),
      reservedRooms: parseNumber(object.reserved_rooms),
    }));

  return {
    auditDate: groupBlocks[0]?.checkinDate,
    groupBlocks,
  };
};

const parseFinalAuditTable = (
  table: ReturnType<typeof splitPepCsvTables>[number] | undefined,
  warnings: string[]
): Partial<ParsedHotelReport> => {
  if (!table) {
    warnings.push("Missing final audit table.");
    return { revenue: [] };
  }

  return {
    revenue: table.rows
      .map((row) => rowToObject(table.header, row))
      .filter((row) => row.charge_type.trim() !== "")
      .map((row) => ({
        amount: parseCurrency(row.net_today || row.actual_today),
        sourceLabel: normalizeLabel(row.charge_type),
      })),
  };
};

const parsePaymentTransactionsTable = (
  table: ReturnType<typeof splitPepCsvTables>[number] | undefined,
  warnings: string[]
): Partial<ParsedHotelReport> => {
  if (!table) {
    warnings.push("Missing payment transactions table.");
    return { payments: [] };
  }

  const payments = table.rows.map((row) => {
    const object = rowToObject(table.header, row);
    return {
      amount: parseCurrency(object.amount),
      paymentType: normalizeLabel(object.payment_type),
    };
  });

  return {
    auditDate: parsePmsDate(
      rowToObject(table.header, table.rows[0] ?? []).date
    ),
    payments,
  };
};
