"use client";

import { useState } from "react";

// Gráficas SVG propias (una serie cada una: sin leyenda, el título nombra la serie).
// Marcas finas, rejilla discreta, texto en tinta de texto, valor al tocar/pasar y vista de tabla.

const W = 340;
const H = 170;
const PAD = { l: 40, r: 10, t: 10, b: 24 };
const IW = W - PAD.l - PAD.r;
const IH = H - PAD.t - PAD.b;

const nf = (n: number, d = 1) => n.toLocaleString("es-ES", { maximumFractionDigits: d });

// Día numérico de una fecha ISO (para escalar el eje X por tiempo real).
const dayNum = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

// Fecha local (a mediodía no hace falta: solo se formatea día/mes).
const toDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short" }).format(toDate(iso));

// Techo "redondo" para el eje Y (4000 en vez de 3190), para que las marcas sean legibles.
export function niceMax(v: number): number {
  const pow = 10 ** Math.floor(Math.log10(v));
  return ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * pow).find((c) => c >= v)) ?? v;
}
const weekdayInitial = (iso: string) => new Intl.DateTimeFormat("es-ES", { weekday: "narrow" }).format(toDate(iso));

// Cuadrícula horizontal con etiquetas del eje Y.
function YGrid({ min, max, unit }: { min: number; max: number; unit: string }) {
  // Marca intermedia solo si cae en un valor entero (evita etiquetas como 80,25).
  const mid = (min + max) / 2;
  const ticks = Number.isInteger(mid) ? [min, mid, max] : [min, max];
  return (
    <>
      {ticks.map((t) => {
        const y = PAD.t + IH - ((t - min) / (max - min)) * IH;
        return (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="var(--border)" strokeWidth="1" />
            <text x={PAD.l - 6} y={y + 4} textAnchor="end" fontSize="10" fill="var(--subtle)">
              {nf(t, unit === "kg" ? 1 : 0)}
            </text>
          </g>
        );
      })}
    </>
  );
}

// Tabla equivalente, para lectores de pantalla y para consultar valores exactos.
function DataTable({ head, rows }: { head: [string, string]; rows: [string, string][] }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="flex h-11 cursor-pointer items-center text-subtle">Ver como tabla</summary>
      <table className="w-full">
        <thead>
          <tr className="text-left text-subtle"><th className="py-1 font-medium">{head[0]}</th><th className="py-1 text-right font-medium">{head[1]}</th></tr>
        </thead>
        <tbody>
          {rows.map(([a, b]) => (
            <tr key={a} className="border-t border-border"><td className="py-1.5">{a}</td><td className="py-1.5 text-right">{b}</td></tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

// Línea temporal (p. ej. peso). Con un solo punto se dibuja solo el marcador.
export function LineChart({ points, unit, label }: { points: { date: string; value: number }[]; unit: string; label: string }) {
  const [sel, setSel] = useState<number | null>(null);
  if (points.length === 0) return null;

  const vals = points.map((p) => p.value);
  // Dominio con holgura para que la línea no pegue con los bordes.
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max((hi - lo) * 0.2, 0.5);
  // Límites enteros: las marcas del eje salen en valores redondos.
  const min = Math.floor(lo - pad), max = Math.ceil(hi + pad);
  const d0 = dayNum(points[0].date), d1 = dayNum(points[points.length - 1].date);
  const x = (date: string) => PAD.l + (d1 === d0 ? IW / 2 : ((dayNum(date) - d0) / (d1 - d0)) * IW);
  const y = (v: number) => PAD.t + IH - ((v - min) / (max - min)) * IH;
  const active = sel !== null ? points[sel] : points[points.length - 1];

  return (
    <div>
      <p className="mb-1 text-sm" aria-live="polite">
        <span className="font-semibold">{nf(active.value)} {unit}</span> <span className="text-subtle">· {shortDate(active.date)}</span>
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${points.length} registros`} className="mx-auto w-full max-w-[520px] touch-manipulation">
        <YGrid min={min} max={max} unit={unit} />
        <polyline fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
          points={points.map((p) => `${x(p.date)},${y(p.value)}`).join(" ")} />
        {points.map((p, i) => (
          <g key={p.date} onClick={() => setSel(i)} onMouseEnter={() => setSel(i)} onMouseLeave={() => setSel(null)} className="cursor-pointer">
            {/* Zona táctil más grande que la marca */}
            <circle cx={x(p.date)} cy={y(p.value)} r="14" fill="transparent" />
            <circle cx={x(p.date)} cy={y(p.value)} r={sel === i ? 6 : 4.5} fill="var(--primary)" stroke="var(--card)" strokeWidth="2" />
          </g>
        ))}
        <text x={PAD.l} y={H - 6} fontSize="10" fill="var(--subtle)">{shortDate(points[0].date)}</text>
        {points.length > 1 && <text x={W - PAD.r} y={H - 6} textAnchor="end" fontSize="10" fill="var(--subtle)">{shortDate(points[points.length - 1].date)}</text>}
      </svg>
      <DataTable head={["Fecha", unit]} rows={[...points].reverse().map((p) => [shortDate(p.date), `${nf(p.value)} ${unit}`])} />
    </div>
  );
}

// Barras diarias con una línea de referencia (objetivo). Los días sin dato no dibujan barra.
export function BarChart({ days, goal, unit, label, detail }: {
  days: { date: string; value: number | null }[]; goal: number | null; unit: string; label: string;
  detail?: (date: string) => string; // texto extra al seleccionar un día
}) {
  const [sel, setSel] = useState<number | null>(null);
  const vals = days.map((d) => d.value ?? 0);
  const max = niceMax(Math.max(...vals, goal ?? 0, 1) * 1.05);
  const slot = IW / days.length;
  const bw = Math.min(slot * 0.62, 28);
  const base = PAD.t + IH;
  const y = (v: number) => base - (v / max) * IH;
  const active = sel !== null ? days[sel] : null;

  // Barra con las esquinas superiores redondeadas (4 px) y la base recta sobre el eje.
  const bar = (cx: number, v: number) => {
    const top = y(v), h = base - top, r = Math.min(4, h, bw / 2), x0 = cx - bw / 2;
    return `M${x0},${base} V${top + r} a${r},${r} 0 0 1 ${r},${-r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} V${base} Z`;
  };

  return (
    <div>
      <p className="mb-1 min-h-5 text-sm" aria-live="polite">
        {active ? (
          <>
            <span className="font-semibold">{active.value ? `${nf(active.value, 0)} ${unit}` : "Sin registro"}</span>{" "}
            <span className="text-subtle">· {shortDate(active.date)}{active.value && detail ? ` · ${detail(active.date)}` : ""}</span>
          </>
        ) : (
          <span className="text-subtle">Toca una barra para ver el día</span>
        )}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="mx-auto w-full max-w-[520px] touch-manipulation">
        <YGrid min={0} max={max} unit={unit} />
        {days.map((d, i) => {
          const cx = PAD.l + slot * i + slot / 2;
          return (
            <g key={d.date} onClick={() => setSel(i)} onMouseEnter={() => setSel(i)} onMouseLeave={() => setSel(null)} className="cursor-pointer">
              <rect x={cx - slot / 2} y={PAD.t} width={slot} height={IH} fill="transparent" />
              {d.value ? <path d={bar(cx, d.value)} fill="var(--primary)" opacity={sel === null || sel === i ? 1 : 0.45} /> : null}
              {(days.length <= 7 || i % 5 === 0 || i === days.length - 1) && (
                <text x={cx} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--subtle)">
                  {days.length <= 7 ? weekdayInitial(d.date) : Number(d.date.slice(8))}
                </text>
              )}
            </g>
          );
        })}
        {goal !== null && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(goal)} y2={y(goal)} stroke="var(--foreground)" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.7" />
            {/* Halo del color de la tarjeta: la etiqueta se lee aunque pase sobre una barra */}
            <text x={W - PAD.r} y={y(goal) - 4} textAnchor="end" fontSize="10" fill="var(--foreground)" stroke="var(--card)" strokeWidth="3" paintOrder="stroke">
              Objetivo {nf(goal, 0)}
            </text>
          </g>
        )}
      </svg>
      <DataTable head={["Día", unit]} rows={days.map((d) => [shortDate(d.date), d.value ? `${nf(d.value, 0)} ${unit}` : "—"])} />
    </div>
  );
}
