const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])$/;
const MS_PER_DAY = 86_400_000;

export const assertIsoDate = (value: string): void => {
  if (!ISO_DATE_REGEX.test(value)) {
    throw new Error(`Invalid date "${value}". Expected YYYY-MM-DD.`);
  }
};

export const assertIsoMonth = (value: string): void => {
  if (!ISO_MONTH_REGEX.test(value)) {
    throw new Error(`Invalid month "${value}". Expected YYYY-MM.`);
  }
};

const dateFromIso = (value: string): Date => {
  assertIsoDate(value);
  return new Date(`${value}T00:00:00.000Z`);
};

export const formatIsoDate = (date: Date): string =>
  date.toISOString().slice(0, 10);

export const addDays = (value: string, days: number): string => {
  const date = dateFromIso(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatIsoDate(date);
};

export const daysBetween = (from: string, to: string): number =>
  Math.round(
    (dateFromIso(to).getTime() - dateFromIso(from).getTime()) / MS_PER_DAY
  );

export const sameDateLastYear = (value: string): string => {
  const date = dateFromIso(value);
  const year = date.getUTCFullYear() - 1;
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const candidate = new Date(Date.UTC(year, month, day));

  if (candidate.getUTCMonth() !== month) {
    return `${year}-02-28`;
  }

  return formatIsoDate(candidate);
};

export const monthRange = (
  month: string
): { endDate: string; startDate: string } => {
  assertIsoMonth(month);
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const startDate = formatIsoDate(new Date(Date.UTC(year, monthIndex, 1)));
  const endDate = formatIsoDate(new Date(Date.UTC(year, monthIndex + 1, 0)));
  return { startDate, endDate };
};

export const datesInRange = (fromDate: string, toDate: string): string[] => {
  assertIsoDate(fromDate);
  assertIsoDate(toDate);

  if (fromDate > toDate) {
    return [];
  }

  const dates: string[] = [];
  let cursor = fromDate;

  while (cursor <= toDate) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
};
