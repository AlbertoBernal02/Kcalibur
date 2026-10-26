// Generación de CSV compatible con Excel en español: separador ";", coma decimal y BOM UTF-8.

export type Cell = string | number | null | undefined;
export type Column<T> = { header: string; value: (row: T) => Cell };

// Un texto que empieza por = + - @ (o tab / retorno) se interpretaría como fórmula al abrirlo en Excel/Sheets.
// Los nombres de alimentos pueden venir de terceros (Open Food Facts), así que se neutraliza con un apóstrofo.
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(v: Cell): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v).replace(".", ",");
  const safe = FORMULA_START.test(v) ? `'${v}` : v;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

// Cabecera + una línea por fila (saltos CRLF, como espera Excel). Sin BOM: lo añade quien descarga.
export function toCsv<T>(columns: Column<T>[], rows: T[]): string {
  const line = (cells: string[]) => cells.join(";");
  return [line(columns.map((c) => cell(c.header))), ...rows.map((r) => line(columns.map((c) => cell(c.value(r)))))].join("\r\n");
}
