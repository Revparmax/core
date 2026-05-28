const ISO_DATE_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const PEP_DATE_REGEX = /^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/;
const OPERA_MONTH_DATE_REGEX = /^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})$/;
const SLASH_DATE_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/;

const MONTHS: Record<string, number> = {
  APR: 3,
  APRIL: 3,
  AUG: 7,
  AUGUST: 7,
  DEC: 11,
  DECEMBER: 11,
  FEB: 1,
  FEBRUARY: 1,
  JAN: 0,
  JANUARY: 0,
  JUL: 6,
  JULY: 6,
  JUN: 5,
  JUNE: 5,
  MAR: 2,
  MARCH: 2,
  MAY: 4,
  NOV: 10,
  NOVEMBER: 10,
  OCT: 9,
  OCTOBER: 9,
  SEP: 8,
  SEPT: 8,
  SEPTEMBER: 8,
};

export const isIsoDate = (value: string): boolean => ISO_DATE_REGEX.test(value);

export const normalizeHeader = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const normalizeLabel = (value: string): string =>
  value.trim().replaceAll(/\s+/g, " ").toUpperCase();

export const parseNumber = (raw: string | undefined): number => {
  if (!raw) {
    return 0;
  }

  const cleaned = raw
    .trim()
    .replaceAll(",", "")
    .replaceAll("%", "")
    .replaceAll(/\s+/g, "");
  if (cleaned === "") {
    return 0;
  }

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const parseCurrency = (raw: string | undefined): number => {
  if (!raw) {
    return 0;
  }

  const trimmed = raw.trim();
  if (trimmed === "") {
    return 0;
  }

  const isNegative = trimmed.startsWith("(") && trimmed.endsWith(")");
  const cleaned = trimmed
    .replaceAll(/[()]/g, "")
    .replaceAll(/[A-Z]{3}/gi, "")
    .replaceAll(",", "")
    .trim();
  const parsed = Number.parseFloat(cleaned);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  const cents = Math.round(parsed * 100);
  return isNegative ? -cents : cents;
};

export const formatIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parsePmsDate = (raw: string | undefined): string | undefined => {
  if (!raw) {
    return;
  }

  const cleaned = raw
    .trim()
    .replaceAll(/\s+(MON|TUE|WED|THU|FRI|SAT|SUN)$/gi, "");
  if (cleaned === "") {
    return;
  }

  if (isIsoDate(cleaned)) {
    return cleaned;
  }

  const pepDate = cleaned.match(PEP_DATE_REGEX);
  if (pepDate) {
    const [, monthName, dayRaw, yearRaw] = pepDate;
    const month = MONTHS[monthName.toUpperCase()];
    const day = Number.parseInt(dayRaw, 10);
    const year = Number.parseInt(yearRaw, 10);
    if (month !== undefined) {
      return formatIsoDate(new Date(year, month, day));
    }
  }

  const operaMonthDate = cleaned.match(OPERA_MONTH_DATE_REGEX);
  if (operaMonthDate) {
    const [, dayRaw, monthName, yearRaw] = operaMonthDate;
    const month = MONTHS[monthName.toUpperCase()];
    const day = Number.parseInt(dayRaw, 10);
    const year =
      yearRaw.length === 2
        ? 2000 + Number.parseInt(yearRaw, 10)
        : Number.parseInt(yearRaw, 10);
    if (month !== undefined) {
      return formatIsoDate(new Date(year, month, day));
    }
  }

  const slashDate = cleaned.match(SLASH_DATE_REGEX);
  if (slashDate) {
    const [, dayRaw, monthRaw, yearRaw] = slashDate;
    const day = Number.parseInt(dayRaw, 10);
    const month = Number.parseInt(monthRaw, 10) - 1;
    const year =
      yearRaw.length === 2
        ? 2000 + Number.parseInt(yearRaw, 10)
        : Number.parseInt(yearRaw, 10);
    return formatIsoDate(new Date(year, month, day));
  }
};

export const calculateAdr = (
  roomRevenue: number | undefined,
  rooms: number | undefined
): number | undefined => {
  if (roomRevenue === undefined || rooms === undefined || rooms <= 0) {
    return;
  }

  return Math.round(roomRevenue / rooms);
};
