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
      return {
        ...base,
        ...parseHistoryForecast(attachment.content, identified.signature),
      };
    case "BUSINESS_ON_THE_BOOKS":
      return { ...base, ...parseBusinessOnTheBooks(attachment.content) };
    case "TRIAL_BALANCE":
      return { ...base, ...parseTrialBalance(attachment.content) };
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
    earlyDepartureRooms: metricValues.get("EARLY_DEP_ROOMS"),
    noShows: metricValues.get("NOSHOW_ROOMS"),
    oooRooms: metricValues.get("OOO_ROOMS"),
    roomsOccupied: metricValues.get("OCC_ROOMS"),
    sameDayCancellations: metricValues.get("CANCELLATIONS_MADE_TODAY"),
    totalRooms: metricValues.get("PHYSICAL_ROOMS"),
    walkIns: metricValues.get("WALKIN_ROOMS"),
  };

  if (!roomStatistics.roomsOccupied) {
    warnings.push("Opera Manager Report did not expose OCC_ROOMS.");
  }

  return { revenue, roomStatistics };
};

// Seeded from legacy revenue_category_extcodes for company 4/source opera.
// Replace this with Convex-backed property/PMS mappings before production ingest.
const TRIAL_BALANCE_REVENUE_CATEGORIES: Record<string, string> = {
  "1000": "ROOMS REVENUE",
  "1005": "ROOMS REVENUE",
  "1010": "ROOMS REVENUE",
  "1305": "ROOM REBATE",
  "4001": "FOOD",
  "4061": "BEVERAGES",
  "4242": "ROOM RENTAL",
  "4243": "EQUIPMENT RENTAL",
  "4246": "MISC.",
  "4251": "SERVICE CHARGE",
  "4501": "PHONE",
  "4507": "FAX & PHOTOCOPY",
  "4511": "PAY PER VIEW MOVIES",
  "4551": "PHONE",
  "4554": "COIN LAUNDRY",
  "4559": "MISC.",
  "4562": "MISC.",
  "4563": "MISC.",
  "4600": "MISC.",
  "4601": "MISC.",
  "4651": "MISC.",
  "4752": "MISC.",
  "4753": "MISC.",
  "5000": "LAUNDRY/VALET",
  "5005": "MISC.",
  "5050": "LAUNDRY/VALET",
  "5106": "MARKET",
  "5108": "MARKET",
  "5110": "MISC.",
  "5160": "MISC.",
  "5201": "MISC.",
  "5560": "PARKING",
};

// Seeded from legacy payment_type_extcodes for company 4/source opera, plus
// 9019 observed in current HIEX Trial Balance XML fixtures.
const TRIAL_BALANCE_PAYMENT_TYPES: Record<string, string> = {
  "9000": "CASH",
  "9001": "CHECK",
  "9002": "DIRECT BILL",
  "9003": "AMEX",
  "9004": "VISA",
  "9005": "MASTERCARD",
  "9006": "DINERS",
  "9007": "DISCOVER",
  "9011": "INTERAC",
  "9013": "INTERAC",
  "9019": "INTERAC",
  "9100": "A/R PAYMENT",
  "9101": "A/R PAYMENT",
};

const aggregateAmount = (
  totals: Map<string, number>,
  label: string,
  amount: number
) => {
  totals.set(label, (totals.get(label) ?? 0) + amount);
};

const parseTrialBalance = (xml: string): Partial<ParsedHotelReport> => {
  const revenueTotals = new Map<string, number>();
  const paymentTotals = new Map<string, number>();
  let auditDate: string | undefined;

  for (const trxTypeBlock of blocksForTag(xml, "G_TRX_TYPE")) {
    const trxType = normalizeLabel(textForTag(trxTypeBlock, "TRX_TYPE"));

    for (const trxCodeBlock of blocksForTag(trxTypeBlock, "G_TRX_CODE")) {
      const code = textForTag(trxCodeBlock, "TRX_CODE");
      const amount = parseCurrency(textForTag(trxCodeBlock, "TB_AMOUNT"));
      auditDate ??= parsePmsDate(textForTag(trxCodeBlock, "TRX_DATE"));

      if (trxType === "REVENUE") {
        const revenueCategory = TRIAL_BALANCE_REVENUE_CATEGORIES[code];
        if (revenueCategory) {
          aggregateAmount(revenueTotals, revenueCategory, amount);
        }
        continue;
      }

      if (trxType === "PAYMENT") {
        const paymentType = TRIAL_BALANCE_PAYMENT_TYPES[code];
        if (paymentType) {
          aggregateAmount(paymentTotals, paymentType, Math.abs(amount));
        }
      }
    }
  }

  return {
    auditDate,
    payments: Array.from(paymentTotals, ([paymentType, amount]) => ({
      amount,
      paymentType,
    })),
    revenue: Array.from(revenueTotals, ([sourceLabel, amount]) => ({
      amount,
      sourceLabel,
    })),
  };
};

const parseHistoryForecast = (
  xml: string,
  signature: string
): Partial<ParsedHotelReport> => {
  if (signature === "RESERVATION_PACE") {
    const paceSnapshots = blocksForTag(xml, "G_STAY_DATE").map((block) => {
      const totalRevenue =
        parseCurrency(textForTag(block, "to_rev_ind")) +
        parseCurrency(textForTag(block, "TO_ROOM_REVENUE_BLK"));
      const roomsOnBooks =
        parseNumber(textForTag(block, "TO_STAY_ROOMS_IND")) +
        parseNumber(textForTag(block, "TO_STAY_ROOMS_BLK"));
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

const parseBusinessOnTheBooks = (xml: string): Partial<ParsedHotelReport> => {
  const paceSnapshots = blocksForTag(xml, "G_CONSIDERED_DATE").map((block) => {
    let availableRooms: number | undefined;
    let totalRooms = 0;
    let totalRevenue = 0;

    for (const sortBlock of blocksForTag(block, "G_SORT_COLUMN")) {
      const columnCode = textForTag(sortBlock, "COLUMN_CODE");
      const dayBlock = blocksForTag(sortBlock, "G_DAY")[0] ?? "";
      const resortRooms = parseNumber(textForTag(dayBlock, "CF_RESORT_ROOMS"));
      const outOfOrderRooms = parseNumber(textForTag(dayBlock, "CF_OOO_ROOMS"));

      if (columnCode === "INDRES" || columnCode === "BLKRES") {
        totalRooms += parseNumber(textForTag(dayBlock, "ROOMS"));
        totalRevenue +=
          parseCurrency(textForTag(dayBlock, "REVENUE_INDIVIDUALS")) +
          parseCurrency(textForTag(dayBlock, "REVENUE_GROUPS"));
      }

      if (resortRooms > 0) {
        availableRooms = resortRooms - outOfOrderRooms - totalRooms;
      }
    }

    return {
      adr: calculateAdr(totalRevenue, totalRooms),
      availableRooms,
      forecastDate: parsePmsDate(textForTag(block, "CONSIDERED_DATE")) ?? "",
      roomsOnBooks: totalRooms,
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
