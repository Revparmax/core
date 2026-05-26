import type {
  ParseContext,
  ParsedHotelReport,
  ValidationIssue,
  ValidationResult,
} from "../types";
import { isIsoDate } from "../utils";

const issue = (
  severity: ValidationIssue["severity"],
  code: string,
  message: string
): ValidationIssue => ({ code, message, severity });

const isNegative = (value: number | undefined): boolean =>
  value !== undefined && value < 0;

export const validateParsedReport = (
  report: ParsedHotelReport,
  context: ParseContext = {}
): ValidationResult => {
  const issues: ValidationIssue[] = [];

  if (report.reportType === "unknown") {
    issues.push(
      issue(
        "error",
        "unknown_report_type",
        `${report.filename} was not identified.`
      )
    );
  }

  if (report.auditDate && !isIsoDate(report.auditDate)) {
    issues.push(
      issue(
        "error",
        "invalid_audit_date",
        `${report.filename} returned non-ISO audit date ${report.auditDate}.`
      )
    );
  }

  if (
    context.expectedAuditDate &&
    report.auditDate &&
    report.auditDate !== context.expectedAuditDate
  ) {
    issues.push(
      issue(
        "warning",
        "audit_date_mismatch",
        `${report.filename} audit date ${report.auditDate} differs from expected ${context.expectedAuditDate}.`
      )
    );
  }

  validateRoomStatistics(report, context, issues);
  validatePaceSnapshots(report, issues);
  validateMarketSegments(report, issues);
  validateRoomTypeAvailability(report, issues);
  validateReservations(report, issues);
  validateGroupBlocks(report, issues);

  if (
    !(
      report.roomStatistics ||
      report.revenue?.length ||
      report.payments?.length ||
      report.paceSnapshots?.length ||
      report.marketSegments?.length ||
      report.roomTypeAvailability?.length ||
      report.bookedReservations?.length ||
      report.cancelledReservations?.length ||
      report.groupBlocks?.length
    ) &&
    report.reportType !== "reference_data" &&
    report.reportType !== "no_show_late_cancel"
  ) {
    issues.push(
      issue(
        "warning",
        "empty_normalized_output",
        `${report.filename} was identified as ${report.reportType} but produced no normalized records.`
      )
    );
  }

  const errors = issues.filter((item) => item.severity === "error");
  const warnings = [
    ...issues.filter((item) => item.severity === "warning"),
    ...report.warnings.map((message) =>
      issue("warning", "parser_warning", `${report.filename}: ${message}`)
    ),
  ];

  return {
    errors,
    isValid: errors.length === 0,
    warnings,
  };
};

const validateRoomStatistics = (
  report: ParsedHotelReport,
  context: ParseContext,
  issues: ValidationIssue[]
) => {
  if (!report.roomStatistics) {
    return;
  }

  const totalRooms = report.roomStatistics.totalRooms ?? context.totalRooms;
  const roomsOccupied = report.roomStatistics.roomsOccupied;

  for (const [field, value] of Object.entries(report.roomStatistics)) {
    if (isNegative(value)) {
      issues.push(
        issue(
          "error",
          "negative_room_stat",
          `${report.filename} has negative room statistic ${field}.`
        )
      );
    }
  }

  if (
    totalRooms !== undefined &&
    roomsOccupied !== undefined &&
    roomsOccupied > totalRooms
  ) {
    issues.push(
      issue(
        "error",
        "rooms_occupied_exceeds_inventory",
        `${report.filename} rooms occupied ${roomsOccupied} exceeds inventory ${totalRooms}.`
      )
    );
  }
};

const validatePaceSnapshots = (
  report: ParsedHotelReport,
  issues: ValidationIssue[]
) => {
  for (const snapshot of report.paceSnapshots ?? []) {
    if (!isIsoDate(snapshot.forecastDate)) {
      issues.push(
        issue(
          "error",
          "invalid_forecast_date",
          `${report.filename} has invalid forecast date ${snapshot.forecastDate}.`
        )
      );
    }

    if (
      isNegative(snapshot.roomsOnBooks) ||
      isNegative(snapshot.availableRooms) ||
      isNegative(snapshot.arrivals) ||
      isNegative(snapshot.departures)
    ) {
      issues.push(
        issue(
          "error",
          "negative_pace_count",
          `${report.filename} contains a negative pace count.`
        )
      );
    }
  }
};

const validateMarketSegments = (
  report: ParsedHotelReport,
  issues: ValidationIssue[]
) => {
  for (const segment of report.marketSegments ?? []) {
    if (!(segment.segmentCode || segment.segmentName)) {
      issues.push(
        issue(
          "error",
          "missing_market_segment_identity",
          `${report.filename} contains a market segment without code or name.`
        )
      );
    }

    if (isNegative(segment.stays) || isNegative(segment.adults)) {
      issues.push(
        issue(
          "error",
          "negative_market_segment_count",
          `${report.filename} contains a negative market segment count.`
        )
      );
    }
  }
};

const validateRoomTypeAvailability = (
  report: ParsedHotelReport,
  issues: ValidationIssue[]
) => {
  for (const roomType of report.roomTypeAvailability ?? []) {
    if (!roomType.roomTypeCode) {
      issues.push(
        issue(
          "error",
          "missing_room_type_code",
          `${report.filename} contains room availability without a room type code.`
        )
      );
    }

    if (
      isNegative(roomType.totalInventory) ||
      isNegative(roomType.sold) ||
      isNegative(roomType.available)
    ) {
      issues.push(
        issue(
          "error",
          "negative_room_type_availability",
          `${report.filename} contains negative room type availability.`
        )
      );
    }

    if (
      roomType.totalInventory > 0 &&
      roomType.sold + roomType.available !== roomType.totalInventory
    ) {
      issues.push(
        issue(
          "warning",
          "room_type_inventory_mismatch",
          `${report.filename} ${roomType.roomTypeCode} sold + available does not equal total inventory.`
        )
      );
    }
  }
};

const validateReservations = (
  report: ParsedHotelReport,
  issues: ValidationIssue[]
) => {
  for (const reservation of report.bookedReservations ?? []) {
    if (!(reservation.arrivalDate && reservation.departureDate)) {
      issues.push(
        issue(
          "error",
          "missing_reservation_dates",
          `${report.filename} contains a booked reservation without arrival or departure date.`
        )
      );
    }
  }

  for (const reservation of report.cancelledReservations ?? []) {
    if (!(reservation.confirmationNumber || reservation.cancellationNumber)) {
      issues.push(
        issue(
          "warning",
          "missing_cancelled_reservation_identity",
          `${report.filename} contains a cancellation without confirmation or cancellation number.`
        )
      );
    }
  }
};

const validateGroupBlocks = (
  report: ParsedHotelReport,
  issues: ValidationIssue[]
) => {
  for (const groupBlock of report.groupBlocks ?? []) {
    if (!(groupBlock.groupCode || groupBlock.groupName)) {
      issues.push(
        issue(
          "error",
          "missing_group_identity",
          `${report.filename} contains a group block without code or name.`
        )
      );
    }

    if (
      isNegative(groupBlock.reservedRooms) ||
      isNegative(groupBlock.availableForPickup) ||
      isNegative(groupBlock.releasedRooms)
    ) {
      issues.push(
        issue(
          "error",
          "negative_group_count",
          `${report.filename} contains a negative group block count.`
        )
      );
    }
  }
};

export const summarizeParsedReport = (report: ParsedHotelReport): string => {
  const parts = [
    `${report.filename}: ${report.systemType}/${report.reportType}`,
    `profile=${report.profileId}`,
  ];

  if (report.auditDate) {
    parts.push(`auditDate=${report.auditDate}`);
  }
  if (report.roomStatistics) {
    parts.push("roomStats=1");
  }
  if (report.revenue?.length) {
    parts.push(`revenue=${report.revenue.length}`);
  }
  if (report.payments?.length) {
    parts.push(`payments=${report.payments.length}`);
  }
  if (report.paceSnapshots?.length) {
    parts.push(`pace=${report.paceSnapshots.length}`);
  }
  if (report.marketSegments?.length) {
    parts.push(`segments=${report.marketSegments.length}`);
  }
  if (report.roomTypeAvailability?.length) {
    parts.push(`roomTypes=${report.roomTypeAvailability.length}`);
  }
  if (report.bookedReservations?.length) {
    parts.push(`booked=${report.bookedReservations.length}`);
  }
  if (report.cancelledReservations?.length) {
    parts.push(`cancelled=${report.cancelledReservations.length}`);
  }
  if (report.groupBlocks?.length) {
    parts.push(`groups=${report.groupBlocks.length}`);
  }

  return parts.join(" ");
};
