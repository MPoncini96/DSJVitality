import Papa from "papaparse";

/** Parse CSV text with a header row into string records. */
export function parseCsv(text: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
  });
  if (result.errors.length > 0) {
    const e = result.errors[0];
    throw new Error(`CSV parse error at row ${e.row}: ${e.message}`);
  }
  return result.data;
}

/** Serialize records to CSV with a fixed column order. */
export function toCsv<T extends object>(rows: T[], columns: (keyof T & string)[]): string {
  const data = rows.map((r) => columns.map((c) => (r as Record<string, unknown>)[c] ?? ""));
  return Papa.unparse({ fields: columns, data }, { newline: "\n" }) + "\n";
}
