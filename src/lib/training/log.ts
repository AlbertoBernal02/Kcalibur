// Interpretación de los textos del Excel ("80 x 7 rir 2", "DESCANSO 1'30"") y cálculos de entreno.

const num = (s: string) => Number(s.replace(",", "."));

export type ParsedLog = { weight: number | null; reps: number | null; rir: number | null };

// Lee un registro libre. Solo toma la primera serie ("80 x 7 + 32,5 x 10" → 80 x 7): el texto original se conserva aparte.
// Admite "20 x 19", "12,5 xlado x 18", "100 x (60 x 10)" (cuenta el peso real de entre paréntesis) y un número suelto (= reps).
export function parseLog(text: string): ParsedLog {
  const t = text.trim();
  const out: ParsedLog = { weight: null, reps: null, rir: null };
  if (!t) return out;
  if (/^\d+$/.test(t)) return { ...out, reps: Number(t) };
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:\([^)]*\))?\s*x(?:\s*lado\s*x)?\s*(\d+)/i);
  if (m) {
    out.weight = num(m[1]);
    out.reps = Number(m[2]);
  }
  const rir = t.match(/rir\s*(\d+(?:[.,]\d+)?)/i);
  if (rir) out.rir = num(rir[1]);
  else if (/fallo|muerte/i.test(t)) out.rir = 0;
  return out;
}

// "DESCANSO 1'30"" → 90 s · "DESCANSO 2'" → 120 s · "DESCANSO 45"" → 45 s. Devuelve también el texto sin esa parte.
export function splitRest(text: string): { seconds: number | null; rest: string } {
  const min = /descanso\s*(\d+)\s*['’′´]\s*(?:(\d{1,2})\s*["”″]?)?/i.exec(text);
  const sec = /descanso\s*(\d+)\s*["”″]/i.exec(text);
  const m = min ?? sec;
  if (!m) return { seconds: null, rest: text };
  const seconds = min ? Number(m[1]) * 60 + Number(m[2] ?? 0) : Number(m[1]);
  return { seconds, rest: (text.slice(0, m.index) + " " + text.slice(m.index + m[0].length)).replace(/\s+/g, " ").trim() };
}

// 1RM estimado (Epley). Con 1 rep es el propio peso; por encima de 12 reps la fórmula pierde fiabilidad, pero se usa igual.
export function est1RM(weight: number, reps: number): number {
  return reps <= 1 ? weight : weight * (1 + reps / 30);
}

// "12,5" para mostrar pesos con coma y sin ceros sobrantes.
export const fmtNum = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 2 });

// "1:30" a partir de segundos.
export const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
