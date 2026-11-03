import ExcelJS from "exceljs";
import { parseRange, type Grid } from "./import-grid.ts";

// Lee un .xlsx y devuelve una Grid por hoja visible (texto de cada celda + celdas combinadas). Solo servidor.
export async function readWorkbook(data: ArrayBuffer | Buffer): Promise<Grid[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as ArrayBuffer);
  return wb.worksheets
    .filter((ws) => ws.state === "visible")
    .map((ws) => {
      const cells: string[][] = [];
      ws.eachRow({ includeEmpty: false }, (row, r) => {
        const out = (cells[r - 1] = [] as string[]);
        row.eachCell({ includeEmpty: false }, (c, col) => {
          // Las celdas "esclavas" de una combinación se dejan vacías: el valor vive solo en la celda superior izquierda.
          out[col - 1] = c.type === ExcelJS.ValueType.Merge ? "" : c.text;
        });
      });
      for (let i = 0; i < cells.length; i++) cells[i] ??= []; // filas vacías → sin huecos
      return { name: ws.name, cells, merges: (ws.model.merges ?? []).map(parseRange) };
    });
}
