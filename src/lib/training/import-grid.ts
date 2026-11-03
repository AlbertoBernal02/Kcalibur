import { parseLog, splitRest } from "./log.ts";
import type { ParsedExercise, ParsedProgram, SetLog } from "./types.ts";

// Hoja ya leída: texto de cada celda y celdas combinadas (0-based: fila1, col1, fila2, col2).
export type Grid = { name: string; cells: string[][]; merges: [number, number, number, number][] };

// "AI10" → [9, 34]
function a1(ref: string): [number, number] {
  const m = /^([A-Z]+)(\d+)$/.exec(ref)!;
  const col = [...m[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  return [Number(m[2]) - 1, col];
}

// "A6:B7" → [5, 0, 6, 1]
export function parseRange(range: string): [number, number, number, number] {
  const [from, to = from] = range.split(":");
  const [r1, c1] = a1(from);
  const [r2, c2] = a1(to);
  return [r1, c1, r2, c2];
}

const WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const ACRONYMS = new Set(["t", "rdl", "dp", "rp", "rm", "rir", "rom", "amrap"]);

// "PRENSA INCLINADA UNILATERAL" → "Prensa inclinada unilateral"; conserva las siglas habituales ("RDL", "DP", "T").
export function niceName(raw: string): string {
  const words = raw.replace(/\s+/g, " ").trim().split(" ");
  return words
    .map((w, i) => {
      const lw = w.toLowerCase();
      if (ACRONYMS.has(lw)) return lw.toUpperCase();
      return i === 0 ? lw.replace(/^\P{L}*\p{L}/u, (m) => m.toUpperCase()) : lw;
    })
    .join(" ");
}

// Día de la semana (1..7) y nombre limpio a partir del título de la hoja ("CUADS-ADUCTORES LUNES").
function dayInfo(sheet: string): { name: string; weekday: number | null } {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const idx = WEEKDAYS.findIndex((d) => norm(sheet).includes(norm(d)));
  const name = sheet.replace(/\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i, "").trim();
  return { name: niceName(name || sheet), weekday: idx < 0 ? null : idx + 1 };
}

type Block = { name: string; start: number; pieces: string[] };

// Convierte una hoja en los ejercicios del día. Devuelve null si no tiene la estructura esperada.
function parseGrid(g: Grid) {
  const cell = (r: number, c: number) => (g.cells[r]?.[c] ?? "").trim();
  const mergeAt = (r: number, c: number) => g.merges.find(([r1, c1, r2, c2]) => r >= r1 && r <= r2 && c >= c1 && c <= c2);

  const header = g.cells.slice(0, 20).findIndex((row) => /^ejercicio$/i.test((row[0] ?? "").trim()));
  if (header < 0) return null;

  // Columnas de cada semana (fila 1: "SEMANA 1" …): series, reps, RIR y registro van seguidos.
  const weekCols = (g.cells[0] ?? []).flatMap((v, c) => {
    const m = /^semana\s*(\d+)/i.exec((v ?? "").trim());
    return m ? [{ week: Number(m[1]), col: c }] : [];
  });
  if (weekCols.length === 0) return null;
  const videoCol = (g.cells[0] ?? []).findIndex((v) => /v[ií]deo/i.test(v ?? ""));

  // 1) Bloques: nombre en celda combinada estrecha (A:B); las combinadas anchas (A:D) son notas del ejercicio anterior.
  const blocks: Block[] = [];
  for (let r = header + 1; r < g.cells.length; r++) {
    const name = cell(r, 0);
    if (!name) continue;
    const m = mergeAt(r, 0);
    if (m && m[0] !== r) continue;
    const isNote = (m ? m[3] >= 3 : false) || /^descanso/i.test(name);
    if (isNote) blocks.at(-1)?.pieces.push(name);
    else blocks.push({ name, start: r, pieces: [cell(r, 2)] });
  }

  // 2) Series de cada bloque (una fila = una serie) y su histórico.
  const exercises: ParsedExercise[] = blocks.map((b, i) => {
    const end = (blocks[i + 1]?.start ?? g.cells.length) - 1;
    const plan: ParsedExercise["plan"] = {};
    const history: SetLog[] = [];
    let video: string | null = null;
    let restFromLog: number | null = null;
    for (let r = b.start; r <= end; r++) {
      if (videoCol >= 0 && !video && /^https?:/i.test(cell(r, videoCol))) video = cell(r, videoCol);
      for (const { week, col } of weekCols) {
        const reps = cell(r, col + 1);
        const text = cell(r, col + 3);
        const rest = splitRest(text);
        // "-" en las tres columnas = fila de descanso; con series > 0 es una serie a fallo/tiempo (plancha, rueda…).
        if (!reps || (reps === "-" && !(Number(cell(r, col)) > 0))) {
          restFromLog ??= rest.seconds;
          continue;
        }
        const sets = (plan[week] ??= []);
        const series = Math.max(1, Math.round(Number(cell(r, col)) || 1));
        const setIndex = sets.length;
        for (let k = 0; k < series; k++) sets.push({ reps, rir: cell(r, col + 2) });
        const p = parseLog(rest.rest);
        if (p.reps !== null || /\p{L}{4,}/u.test(rest.rest)) history.push({ week, setIndex, ...p, note: rest.rest });
      }
    }
    // Descanso y notas: lo que ponga en C y en las celdas anchas, sin la parte "DESCANSO …".
    let restSeconds: number | null = null;
    const notes: string[] = [];
    for (const piece of b.pieces) {
      const s = splitRest(piece);
      restSeconds ??= s.seconds;
      const left = s.rest.replace(/^[\s|·-]+|[\s|·-]+$/g, "");
      if (left && !/^descanso$/i.test(left)) notes.push(left);
    }
    return { name: niceName(b.name), notes: notes.join(" · "), restSeconds: restSeconds ?? restFromLog, videoUrl: video, plan, history };
  });

  return { weeks: Math.max(...weekCols.map((w) => w.week)), exercises: exercises.filter((e) => Object.keys(e.plan).length > 0) };
}

// Hojas → rutina. Las hojas que no encajan se ignoran; si no queda ninguna, devuelve null.
export function parseGrids(grids: Grid[]): ParsedProgram | null {
  const parsed = grids.flatMap((g) => {
    const p = parseGrid(g);
    return p && p.exercises.length ? [{ weeks: p.weeks, day: { ...dayInfo(g.name), exercises: p.exercises } }] : [];
  });
  if (parsed.length === 0) return null;
  return { weeks: Math.max(...parsed.map((p) => p.weeks)), days: parsed.map((p) => p.day) };
}
