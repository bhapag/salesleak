/**
 * Small hand-rolled CSV parser (no new dependency for something this
 * contained). Handles quoted fields, embedded commas/newlines, and escaped
 * quotes (""); ragged rows (wrong column count) are padded/truncated rather
 * than thrown on, since a malformed export should degrade to "some invalid
 * rows," never a crashed import screen.
 */
export type ParsedCsv = { headers: string[]; rows: string[][] };

export function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  // Normalize CRLF/CR to LF up front so the state machine only deals with \n.
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];

    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\n") {
      pushRow();
    } else {
      field += ch;
    }
  }
  // Trailing field/row (files without a final newline).
  if (field.length > 0 || row.length > 0) pushRow();

  const nonEmpty = rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = nonEmpty[0].map((h) => h.trim());
  const dataRows = nonEmpty.slice(1).map((r) => {
    if (r.length === headers.length) return r;
    if (r.length < headers.length) return [...r, ...Array(headers.length - r.length).fill("")];
    return r.slice(0, headers.length);
  });

  return { headers, rows: dataRows };
}

// A leading =, +, -, @, tab, or CR makes Excel/Sheets interpret a cell as a
// formula when the CSV is opened — dangerous here because export values (lead/
// customer names, etc.) can originate from untrusted, unauthenticated sources
// (the public website form, CSV import). Prefixing with a single quote forces
// text interpretation; Excel treats a leading `'` as a formatting marker and
// doesn't display it, so ordinary values (including phone numbers starting
// with "+") still show correctly to the person opening the export.
const FORMULA_INJECTION_RE = /^[=+\-@\t\r]/;

function neutralizeFormula(value: string): string {
  return FORMULA_INJECTION_RE.test(value) ? `'${value}` : value;
}

/** Quotes a single CSV field only when it needs it (contains a comma, quote, or newline) — same escaping convention parseCsv() reads back. */
function csvField(value: string): string {
  const safe = neutralizeFormula(value);
  if (/[",\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

/** The write-side counterpart to parseCsv() — used by the company-data export (Phase 13), not by CSV import. */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(csvField).join(",")];
  for (const row of rows) {
    lines.push(row.map((cell) => csvField(cell == null ? "" : String(cell))).join(","));
  }
  return lines.join("\r\n");
}
