import { normalizeHeader } from "./utils";

export interface CsvTable {
  header: string[];
  rows: string[][];
}

export const parseCsvRows = (content: string): string[][] => {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      currentCell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentCell = "";
      currentRow = [];
      continue;
    }

    currentCell += char;
  }

  if (currentCell !== "" || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
};

export const splitCsvTables = (rows: string[][]): CsvTable[] => {
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

    const normalized = row.map(normalizeHeader);
    const looksLikeHeader =
      normalized.includes("date") ||
      normalized.includes("description") ||
      normalized.includes("charge_type") ||
      normalized.includes("confirmation_number") ||
      normalized.includes("group_name") ||
      normalized.includes("room_number") ||
      normalized.includes("account_type");

    if (!currentHeader || looksLikeHeader) {
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

export const rowToObject = (
  header: string[],
  row: string[]
): Record<string, string> => {
  const object: Record<string, string> = {};

  header.forEach((column, index) => {
    object[normalizeHeader(column)] = row[index]?.trim() ?? "";
  });

  return object;
};

export const hasColumns = (header: string[], columns: string[]): boolean => {
  const normalized = new Set(header.map(normalizeHeader));
  return columns.every((column) => normalized.has(column));
};
