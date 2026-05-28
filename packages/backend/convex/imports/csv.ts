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
