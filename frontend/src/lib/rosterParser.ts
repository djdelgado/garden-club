import { DirectoryImportRow } from "@/types/directory";

/** Spreadsheet header (normalised) → directory field. */
const HEADER_ALIASES: Record<string, keyof DirectoryImportRow> = {
  name: "name",
  "full name": "name",
  fullname: "name",
  "member name": "name",
  email: "email",
  "e-mail": "email",
  "email address": "email",
  "e-mail address": "email",
  phone: "phone",
  "phone number": "phone",
  telephone: "phone",
  mobile: "phone",
  cell: "phone",
  address: "address",
  "street address": "address",
  "mailing address": "address",
};

export const MAX_IMPORT_ROWS = 1000;

export interface ParsedRoster {
  rows: DirectoryImportRow[];
  /** Header cells that didn't map to a field (shown so the admin can rename them). */
  unrecognized: string[];
  /** Which field each recognised column feeds, for the preview. */
  mapped: (keyof DirectoryImportRow)[];
}

const normalise = (header: unknown) =>
  String(header ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, " ");

const cellText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value).trim();
};

/**
 * Turn a header row + data rows into import rows. The first row must be the
 * header; columns are matched case-insensitively by HEADER_ALIASES. Fully blank
 * rows are dropped. Throws a user-facing Error when no usable columns are found.
 */
export function rowsFromTable(table: unknown[][]): ParsedRoster {
  const [header = [], ...body] = table;
  const columns = header.map((h) => HEADER_ALIASES[normalise(h)]);
  const unrecognized = header
    .filter((h, i) => !columns[i] && cellText(h))
    .map((h) => cellText(h));

  if (!columns.includes("name") && !columns.includes("email")) {
    throw new Error(
      'Couldn\'t find a "Name" or "Email" column. The first row of the sheet must be column headers.'
    );
  }

  const rows: DirectoryImportRow[] = [];
  for (const cells of body) {
    const row: DirectoryImportRow = {};
    columns.forEach((field, i) => {
      if (!field) return;
      const text = cellText(cells[i]);
      // Two columns can map to one field (e.g. "Phone" and "Mobile"): keep the first non-blank.
      if (text && !row[field]) row[field] = text;
    });
    if (Object.values(row).some(Boolean)) rows.push(row);
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    throw new Error(`That file has ${rows.length} rows; the limit is ${MAX_IMPORT_ROWS} per import.`);
  }

  const mapped = Array.from(new Set(columns.filter(Boolean))) as (keyof DirectoryImportRow)[];
  return { rows, unrecognized, mapped };
}

/**
 * Parse an .xlsx or .csv roster in the browser. Both parsers are loaded on
 * demand so they don't ship in the main bundle.
 */
export async function parseRosterFile(file: File): Promise<ParsedRoster> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv") || file.type === "text/csv") {
    const Papa = (await import("papaparse")).default;
    const text = await file.text();
    const result = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
    if (result.errors.length && !result.data.length) {
      throw new Error(`Couldn't read that CSV: ${result.errors[0].message}`);
    }
    return rowsFromTable(result.data);
  }

  if (name.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    return rowsFromTable(await readSheet(file));
  }

  if (name.endsWith(".xls")) {
    throw new Error('Old .xls files aren\'t supported. In Excel, use "Save As" → .xlsx or .csv.');
  }
  throw new Error("Please choose an .xlsx or .csv file.");
}
