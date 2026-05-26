import type {
  IdentifiedReport,
  ImportAttachment,
  ParsedHotelReport,
  ParserProfile,
  ReportType,
} from "../types";
import {
  calculateAdr,
  normalizeLabel,
  parseCurrency,
  parseNumber,
  parsePmsDate,
} from "../utils";
import { blocksForTag, extractRootElement, textForTag } from "../xml";

export const OPERA_REPORTS_12_PROFILE: ParserProfile = {
  id: "opera.reports_12_2_1_4_0",
  isDefault: false,
  label: "Oracle Opera Reports 12.2.1.4.0 XML",
  systemType: "opera",
};

export const OPERA_DEFAULT_PROFILE: ParserProfile = {
  id: "opera.default",
  isDefault: true,
  label: "Oracle Opera default XML reports",
  systemType: "opera",
};

const ROOT_REPORT_TYPES: Record<string, ReportType> = {
  ARAGINGSUM: "ar_invoice_aging",
  BLK_FORECAST: "group_reservations",
  BUSINESS_ON_THE_BOOKS: "occupancy_forecast",
  CF_TRXCODES1: "reference_data",
  DEPOSIT_LEDGER: "advance_deposit",
  DETAIL_AVAIL: "room_availability",
  FINJRNLBYTRANS: "all_transactions",
  GUEST_LEDGER: "guest_ledger",
  HISTORY_FORECAST: "occupancy_forecast",
  HISTORY_FORECAST_BLK: "occupancy_forecast",
  HKOOOBYREASON: "maintenance",
  MANAGER_REPORT: "hotel_statistics",
  RES_FORECAST1: "market_segment",
  RES_STATISTICS1: "market_segment",
  RESENTEREDON: "booked_reservations",
  RESERVATION_PACE: "occupancy_forecast",
  TRIAL_BALANCE: "final_audit",
};

export const identifyOperaReport = (
  attachment: ImportAttachment
): IdentifiedReport | undefined => {
  const extensionMatch = attachment.filename.toLowerCase().endsWith(".xml");
  const mimeMatch =
    attachment.contentType === "text/xml" ||
    attachment.contentType === "application/xml";

  if (!(extensionMatch || mimeMatch || attachment.content.includes("<?xml"))) {
    return;
  }

  const rootElement = extractRootElement(attachment.content);
  const generatedByOperaReports = attachment.content.includes(
    "Oracle Reports version 12.2.1.4.0"
  );
  const profile = generatedByOperaReports
    ? OPERA_REPORTS_12_PROFILE
    : OPERA_DEFAULT_PROFILE;

  if (!rootElement) {
    return {
      confidence: 0,
      profile,
      reportType: "unknown",
      signature: "missing_root",
    };
  }

  const reportType = ROOT_REPORT_TYPES[rootElement] ?? "unknown";
  const skipReason =
    reportType === "reference_data"
      ? "Reference/configuration XML; not a daily audit report."
      : undefined;

  return {
    confidence: reportType === "unknown" ? 0.25 : 1,
    profile,
    reportType,
    signature: rootElement,
    skipReason,
  };
};

export const parseOperaReport = (
  attachment: ImportAttachment,
  identified: IdentifiedReport
): ParsedHotelReport => {
  const warnings: string[] = [];
  const base: ParsedHotelReport = {
    confidence: identified.confidence,
    filename: attachment.filename,
    profileId: identified.profile.id,
    reportType: identified.reportType,
    rowCount: attachment.content.split("\n").length,
    systemType: "opera",
    warnings,
  };

  switch (identified.signature) {
    case "MANAGER_REPORT":
      return { ...base, ...parseManagerReport(attachment.content, warnings) };
    case "HISTORY_FORECAST":
    case "RESERVATION_PACE":
    case "BUSINESS_ON_THE_BOOKS":
      return {
        ...base,
        ...parseHistoryForecast(attachment.content, identified.signature),
      };
    case "RES_STATISTICS1":
    case "RES_FORECAST1":
      return { ...base, ...parseMarketSegments(attachment.content, warnings) };
    case "DETAIL_AVAIL":
      return {
        ...base,
        ...parseRoomAvailability(attachment.content, warnings),
      };
    default:
      if (identified.skipReason) {
        warnings.push(identified.skipReason);
      } else {
        warnings.push(
          `${identified.signature} is identified but does not yet have a normalized parser.`
        );
      }
      return base;
  }
};

const parseManagerReport = (
  xml: string,
  warnings: string[]
): Partial<ParsedHotelReport> => {
  const metricValues = new Map<string, number>();
  const revenue: NonNullable<ParsedHotelReport["revenue"]> = [];

  for (const block of blocksForTag(xml, "G_MASTER_VALUE")) {
    const code = textForTag(block, "SUB_GRP_1");
    const description = textForTag(block, "DESCRIPTION");
    const formatType = textForTag(block, "AMOUNT_FORMAT_TYPE");
    const firstAmountBlock = blocksForTag(block, "G_SUM_AMOUNT")[0];
    if (!(code && firstAmountBlock)) {
      continue;
    }

    const value = parseNumber(textForTag(firstAmountBlock, "SUM_AMOUNT"));
    metricValues.set(
      code,
      formatType === "C" ? Math.round(value * 100) : value
    );

    if (code.includes("REVENUE") && description) {
      revenue.push({
        amount: formatType === "C" ? Math.round(value * 100) : value,
        sourceLabel: normalizeLabel(description),
      });
    }
  }

  const roomStatistics = {
    adr: metricValues.get("ADR_ROOM"),
    compRooms: metricValues.get("COMP_ROOMS"),
    noShows: metricValues.get("NOSHOW_ROOMS"),
    oooRooms: metricValues.get("OOO_ROOMS"),
    roomsOccupied: metricValues.get("OCC_ROOMS"),
    sameDayCancellations: metricValues.get("CANCELLATIONS_MADE_TODAY"),
    totalRooms: metricValues.get("PHYSICAL_ROOMS"),
  };

  if (!roomStatistics.roomsOccupied) {
    warnings.push("Opera Manager Report did not expose OCC_ROOMS.");
  }

  return { revenue, roomStatistics };
};

const parseHistoryForecast = (
  xml: string,
  signature: string
): Partial<ParsedHotelReport> => {
  if (signature === "RESERVATION_PACE") {
    const paceSnapshots = blocksForTag(xml, "G_STAY_DATE").map((block) => {
      const totalRevenue = parseCurrency(textForTag(block, "to_rev_ind"));
      const roomsOnBooks =
        parseNumber(textForTag(block, "TO_STAY_ROOMS_IND")) +
        parseNumber(textForTag(block, "TO_STAY_ROOMS_GRP"));
      return {
        adr: calculateAdr(totalRevenue, roomsOnBooks),
        availableRooms: parseNumber(textForTag(block, "TO_AVAIL")),
        forecastDate: parsePmsDate(textForTag(block, "STAY_DATE")) ?? "",
        roomsOnBooks,
        totalRevenue,
      };
    });

    return {
      auditDate: paceSnapshots[0]?.forecastDate,
      paceSnapshots,
    };
  }

  const paceSnapshots = blocksForTag(xml, "G_CONSIDERED_DATE").map((block) => {
    const totalRevenue =
      parseCurrency(textForTag(block, "IND_DEDUCT_REVENUE")) +
      parseCurrency(textForTag(block, "IND_NON_DEDUCT_REVENUE")) +
      parseCurrency(textForTag(block, "GRP_DEDUCT_REVENUE")) +
      parseCurrency(textForTag(block, "GRP_NON_DEDUCT_REVENUE"));
    const roomsOnBooks = parseNumber(textForTag(block, "NO_ROOMS"));
    return {
      adr: calculateAdr(totalRevenue, roomsOnBooks),
      arrivals: parseNumber(textForTag(block, "ARRIVAL_ROOMS")),
      availableRooms:
        parseNumber(textForTag(block, "INVENTORY_ROOMS")) - roomsOnBooks,
      departures: parseNumber(textForTag(block, "DEPARTURE_ROOMS")),
      forecastDate: parsePmsDate(textForTag(block, "CONSIDERED_DATE")) ?? "",
      roomsOnBooks,
      totalRevenue,
    };
  });

  return {
    auditDate: paceSnapshots[0]?.forecastDate,
    paceSnapshots,
  };
};

const parseMarketSegments = (
  xml: string,
  warnings: string[]
): Partial<ParsedHotelReport> => {
  const dayBlocks = blocksForTag(xml, "DAY");
  const firstDay = dayBlocks[0];
  if (!firstDay) {
    warnings.push("Opera market segment XML did not contain DAY blocks.");
    return { marketSegments: [] };
  }

  const auditDate =
    parsePmsDate(textForTag(firstDay, "BUSINESS_DATE")) ??
    parsePmsDate(textForTag(firstDay, "RESERVATION_DATE"));

  const marketSegments = blocksForTag(firstDay, "MARKET").map((block) => {
    const roomRevenue = parseCurrency(textForTag(block, "REVENUE"));
    const totalRevenue = parseCurrency(textForTag(block, "TOTAL_REVENUE"));
    const stays = parseNumber(textForTag(block, "NO_DEFINITE_ROOMS"));
    return {
      adr: calculateAdr(roomRevenue, stays),
      adults: parseNumber(textForTag(block, "IN_GUEST")),
      children: 0,
      occupancyContribution: parseNumber(textForTag(block, "PER_OCC")),
      roomRevenue,
      segmentCode: textForTag(block, "MARKET_CODE"),
      segmentName:
        textForTag(block, "GROUP_NAME") || textForTag(block, "MARKET_CODE"),
      stays,
      totalRevenue,
    };
  });

  return { auditDate, marketSegments };
};

const parseRoomAvailability = (
  xml: string,
  warnings: string[]
): Partial<ParsedHotelReport> => {
  const firstDay = blocksForTag(xml, "DAY")[0];
  if (!firstDay) {
    warnings.push("Opera room availability XML did not contain DAY blocks.");
    return { roomTypeAvailability: [] };
  }

  const roomTypeAvailability = blocksForTag(firstDay, "ROOM_TYPE")
    .map((block) => {
      const roomTypeCode = textForTag(block, "MARKET_CODE");
      const available = parseNumber(textForTag(block, "NO_OF_ROOMS1"));
      return {
        available,
        roomTypeCode,
        roomTypeName: roomTypeCode,
        sold: 0,
        totalInventory: available,
      };
    })
    .filter((line) => normalizeLabel(line.roomTypeCode) !== "TOTAL");

  return {
    auditDate: parsePmsDate(textForTag(firstDay, "BUSINESS_DATE")),
    roomTypeAvailability,
  };
};
