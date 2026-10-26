import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { MEAL_COLOR } from "@/lib/meals";
import type { Goals } from "@/lib/nutrition";
import { mealBreakdown, totals } from "@/lib/summary";
import type { Entry } from "@/lib/data/diary";

const fmt = (n: number) => Math.round(n).toLocaleString("es-ES");

// Resumen del día: anillo de kcal, barras de macros y desglose por comida.
export function DaySummary({ entries, goals }: { entries: Entry[]; goals: Goals | null }) {
  const t = totals(entries);

  if (!goals) {
    return (
      <div className="mb-5 rounded-3xl bg-card p-5">
        <p className="text-3xl font-bold">{fmt(t.kcal)} <span className="text-base font-medium text-subtle">kcal</span></p>
        <p className="mt-1 text-sm text-subtle">
          P {fmt(t.protein_g)} g · H {fmt(t.carbs_g)} g · G {fmt(t.fat_g)} g
        </p>
        <Link href="/perfil" className="mt-3 inline-flex h-11 items-center text-sm font-semibold text-primary">
          Define tus objetivos para ver lo que te falta →
        </Link>
      </div>
    );
  }

  return (
    <>
      <section aria-label="Resumen del día" className="mb-3 flex items-center gap-4 rounded-3xl bg-card p-4">
        <Ring value={t.kcal} goal={goals.kcal} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <MacroBar label="Proteína" value={t.protein_g} goal={goals.protein_g} color="bg-protein" />
          <MacroBar label="Hidratos" value={t.carbs_g} goal={goals.carbs_g} color="bg-carbs" />
          <MacroBar label="Grasa" value={t.fat_g} goal={goals.fat_g} color="bg-fat" />
        </div>
      </section>
      <Breakdown entries={entries} />
    </>
  );
}

// Anillo de progreso de kcal; el centro muestra lo que falta (o lo que te pasas).
function Ring({ value, goal }: { value: number; goal: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const left = goal - value;
  const over = left < 0;
  return (
    <div
      className="relative h-32 w-32 shrink-0"
      role="img"
      aria-label={`${fmt(value)} de ${fmt(goal)} kilocalorías. ${over ? `Te pasas ${fmt(-left)}` : `Te faltan ${fmt(left)}`}`}
    >
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="11" className="stroke-muted" />
        <circle
          cx="60" cy="60" r={r} fill="none" strokeWidth="11" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(value / goal, 1))}
          className={`transition-[stroke-dashoffset] duration-500 ${over ? "stroke-carbs" : "stroke-primary"}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={`text-2xl font-bold leading-none ${over ? "text-carbs" : ""}`}>{fmt(Math.abs(left))}</span>
        <span className="mt-1 text-xs text-subtle">{over ? "kcal de más" : "kcal faltan"}</span>
        <span className="mt-0.5 text-[11px] text-subtle">de {fmt(goal)}</span>
      </div>
    </div>
  );
}

// Barra de un macro: consumido / objetivo y gramos que faltan.
function MacroBar({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const left = goal - value;
  const pct = goal > 0 ? Math.min((value / goal) * 100, 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-subtle">{fmt(value)} / {fmt(goal)} g</span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.round(value)}>
        <div className={`h-full rounded-full transition-[width] duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-0.5 text-xs text-subtle">{left >= 0 ? `Faltan ${fmt(left)} g` : `${fmt(-left)} g de más`}</p>
    </div>
  );
}

// Desglose por comida (plegable): barra segmentada + kcal, macros y % del día.
function Breakdown({ entries }: { entries: Entry[] }) {
  const meals = mealBreakdown(entries);
  const hasData = meals.some((m) => m.kcal > 0);
  return (
    <details className="group mb-5 rounded-3xl bg-card">
      <summary className="flex h-14 cursor-pointer list-none items-center justify-between px-5 font-semibold [&::-webkit-details-marker]:hidden">
        Desglose por comida
        <ChevronDown size={20} className="text-subtle transition group-open:rotate-180" />
      </summary>
      <div className="px-5 pb-5">
        {!hasData ? (
          <p className="text-sm text-subtle">Añade alimentos para ver cómo se reparte tu día.</p>
        ) : (
          <>
            <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
              {meals.map((m) => (
                <div key={m.meal} style={{ width: `${m.pct}%`, backgroundColor: MEAL_COLOR[m.meal] }} />
              ))}
            </div>
            <ul className="flex flex-col gap-3">
              {meals.map((m) => (
                <li key={m.meal} className="flex items-center gap-3">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: MEAL_COLOR[m.meal] }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{m.label}</span>
                    <span className="block text-xs text-subtle">P {fmt(m.protein_g)} · H {fmt(m.carbs_g)} · G {fmt(m.fat_g)}</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-semibold">{fmt(m.kcal)} kcal</span>
                    <span className="block text-xs text-subtle">{fmt(m.pct)} %</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </details>
  );
}
