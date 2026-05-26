export type PmsSystemType = "opera" | "pep";

export type ReportType =
  | "advance_deposit"
  | "all_transactions"
  | "ar_invoice_aging"
  | "booked_reservations"
  | "cancelled_reservations"
  | "final_audit"
  | "group_reservations"
  | "guest_ledger"
  | "hotel_statistics"
  | "maintenance"
  | "market_segment"
  | "no_show_late_cancel"
  | "occupancy_forecast"
  | "payment_transactions"
  | "room_availability"
  | "reference_data"
  | "unknown";

export interface ImportAttachment {
  content: string;
  contentType?: string;
  filename: string;
}

export interface ParserProfile {
  id: string;
  isDefault: boolean;
  label: string;
  systemType: PmsSystemType;
}

export interface IdentifiedReport {
  confidence: number;
  profile: ParserProfile;
  reportType: ReportType;
  signature: string;
  skipReason?: string;
}

export interface ParsedReportBase {
  auditDate?: string;
  confidence: number;
  filename: string;
  profileId: string;
  reportType: ReportType;
  rowCount: number;
  systemType: PmsSystemType;
  warnings: string[];
}

export interface RoomStatisticSnapshot {
  adr?: number;
  compRooms?: number;
  noShows?: number;
  oooRooms?: number;
  roomsOccupied?: number;
  sameDayCancellations?: number;
  totalRooms?: number;
}

export interface RevenueLine {
  amount: number;
  sourceLabel: string;
}

export interface PaymentLine {
  amount: number;
  paymentType: string;
}

export interface PaceSnapshotLine {
  adr?: number;
  arrivals?: number;
  availableRooms?: number;
  departures?: number;
  forecastDate: string;
  roomsOnBooks: number;
  totalRevenue?: number;
}

export interface MarketSegmentLine {
  adr?: number;
  adults?: number;
  children?: number;
  occupancyContribution?: number;
  revparContribution?: number;
  roomRevenue: number;
  segmentCode: string;
  segmentName: string;
  stays: number;
  totalRevenue: number;
}

export interface RoomTypeAvailabilityLine {
  available: number;
  roomTypeCode: string;
  roomTypeName: string;
  sold: number;
  totalInventory: number;
}

export interface BookedReservationLine {
  adr?: number;
  arrivalDate: string;
  bookingDate?: string;
  companyName?: string;
  confirmationNumber?: string;
  departureDate: string;
  guestName?: string;
  marketSegment?: string;
  nights?: number;
  ratePlan?: string;
  roomType?: string;
  source?: string;
  totalRoomRate?: number;
}

export interface CancelledReservationLine {
  arrivalDate?: string;
  cancellationDate?: string;
  cancellationNumber?: string;
  confirmationNumber?: string;
  guestName?: string;
  nights?: number;
  ratePlan?: string;
  roomType?: string;
  source?: string;
}

export interface GroupBlockLine {
  availableForPickup: number;
  checkinDate?: string;
  checkoutDate?: string;
  groupCode: string;
  groupName: string;
  ratePlan?: string;
  releasedRooms: number;
  reservedRooms: number;
}

export interface ParsedHotelReport extends ParsedReportBase {
  bookedReservations?: BookedReservationLine[];
  cancelledReservations?: CancelledReservationLine[];
  groupBlocks?: GroupBlockLine[];
  marketSegments?: MarketSegmentLine[];
  paceSnapshots?: PaceSnapshotLine[];
  payments?: PaymentLine[];
  revenue?: RevenueLine[];
  roomStatistics?: RoomStatisticSnapshot;
  roomTypeAvailability?: RoomTypeAvailabilityLine[];
}

export interface ParseContext {
  expectedAuditDate?: string;
  propertyName?: string;
  totalRooms?: number;
}

export interface ValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  errors: ValidationIssue[];
  isValid: boolean;
  warnings: ValidationIssue[];
}
