// Hand-rolled CSV parsing/serialization for the upload flow. No dependency,
// the format is small (two columns) and a real parser earns its keep: quoted
// fields, embedded commas, escaped "" quotes. RFC4180-ish, not a full spec.

export type CsvRecord = Record<string, string>;

export interface UploadRow {
  mpn: string;
  description: string;
}

// Splits raw CSV text into rows of cells, honoring double-quoted fields that
// may contain commas, embedded newlines, or escaped "" quotes.
function splitCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

// Parses CSV text into header-keyed records (header names lower-cased/trimmed
// so callers can match case-insensitively).
export function parseCsv(text: string): CsvRecord[] {
  const rows = splitCsvRows(text).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((cells) => {
    const rec: CsvRecord = {};
    header.forEach((h, i) => {
      rec[h] = (cells[i] ?? "").trim();
    });
    return rec;
  });
}

// Pulls the mpn/description columns an uploaded BOM would carry. Tolerant of
// a couple of common header spellings for the MPN column. A row with no MPN
// at all is dropped here; a row whose MPN fails to match the parts network is
// NOT dropped: that distinction (UNRESOLVED) is made downstream by
// resolveUploadRows, never here.
export function extractUploadRows(records: CsvRecord[]): UploadRow[] {
  return records
    .map((r) => ({
      mpn: r["mpn"] ?? r["part number"] ?? r["pn"] ?? r["part_number"] ?? "",
      description: r["description"] ?? r["desc"] ?? "",
    }))
    .map((r) => ({ mpn: r.mpn.trim(), description: r.description.trim() }))
    .filter((r) => r.mpn.length > 0);
}

// Serializes an arbitrary grid to RFC4180-ish CSV text: the inverse of
// splitCsvRows above, quoting any cell that carries a comma, a quote or a
// newline. One serializer, so the two-column template and the wide ERP export
// (lib/data/sampleUpload.ts) cannot escape their cells differently.
export function toCsv(header: string[], rows: string[][]): string {
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [header.map(escape).join(",")];
  for (const r of rows) lines.push(r.map(escape).join(","));
  return lines.join("\n") + "\n";
}

// Serializes rows to CSV text for the template download, using the exact columns
// extractUploadRows expects: mpn, description.
export function buildCsvText(header: string[], rows: UploadRow[]): string {
  return toCsv(
    header,
    rows.map((r) => [r.mpn, r.description])
  );
}
