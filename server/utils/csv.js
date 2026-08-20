/** Minimal CSV helpers — no npm package. */

export function escapeCsv(value) {
  if (value == null) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * @param {string[]} headers
 * @param {Array<Record<string, unknown>|unknown[]>} rows - objects keyed by headers, or arrays
 * @param {{ bom?: boolean }} [options]
 */
export function rowsToCsv(headers, rows, { bom = true } = {}) {
  const lines = [headers.map(escapeCsv).join(',')];
  for (const row of rows) {
    if (Array.isArray(row)) {
      lines.push(row.map(escapeCsv).join(','));
    } else {
      lines.push(headers.map((h) => escapeCsv(row[h])).join(','));
    }
  }
  const body = lines.join('\r\n');
  return bom ? `\uFEFF${body}` : body;
}

export function csvDateStamp(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
