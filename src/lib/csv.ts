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
