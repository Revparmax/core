import type { CsvTable } from "../csv";
import { normalizeHeader } from "../utils";

export const splitPepCsvTables = (rows: string[][]): CsvTable[] => {
  const tables: CsvTable[] = [];
  let currentHeader: string[] | undefined;
  let currentRows: string[][] = [];

  const flush = () => {
    if (currentHeader && currentRows.length > 0) {
      tables.push({ header: currentHeader, rows: currentRows });
    }
    currentHeader = undefined;
    currentRows = [];
  };

  for (const row of rows) {
    const hasCells = row.some((cell) => cell.trim() !== "");
    if (!hasCells) {
      flush();
      continue;
    }

    if (isPepHeaderRow(row) || !currentHeader) {
      flush();
      currentHeader = row;
      currentRows = [];
      continue;
    }

    currentRows.push(row);
  }

  flush();
  return tables;
};

const isPepHeaderRow = (row: string[]): boolean => {
  const normalized = row.map(normalizeHeader);

  return (
    normalized.includes("account_type") ||
    normalized.includes("charge_type") ||
    normalized.includes("confirmation_number") ||
    normalized.includes("date") ||
    normalized.includes("description") ||
    normalized.includes("group_name") ||
    normalized.includes("room_number")
  );
};
