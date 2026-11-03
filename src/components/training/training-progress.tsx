"use client";

import { Trophy } from "lucide-react";
import { fmtNum } from "@/lib/training/log";
import { programProgress, weeklyVolume, type ExerciseProgress } from "@/lib/training/progress";
import { ErrorNote } from "./bits";
import { useProgram } from "./use-program";

// Pantalla "Progreso" del modo Entreno: volumen por semana y evolución de cada ejercicio.
export function TrainingProgress() {
  const { program, error } = useProgram();
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (program === undefined) return <div className="h-48 animate-pulse rounded-3xl bg-muted" aria-label="Cargando progreso" />;
  if (program === null) return <p className="text-subtle">Importa una rutina en la pestaña Hoy para ver tu progreso.</p>;

  const volume = weeklyVolume(program);
  const maxKg = Math.max(1, ...volume.map((v) => v.kg));
  const exercises = programProgress(program.days).sort((a, b) => (b.change ?? -Infinity) - (a.change ?? -Infinity));

  return (
    <>
      <section aria-label="Volumen por semana" className="mb-5 rounded-3xl bg-card p-5">
        <h2 className="font-semibold">Volumen por semana</h2>
        <p className="text-xs text-subtle">Peso × repeticiones de todas las series, en kg.</p>
        <div className="mt-4 flex h-32 items-end gap-2">
          {volume.map((v) => (
            <div key={v.week} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] tabular-nums text-subtle">{v.kg ? fmtNum(Math.round(v.kg / 100) / 10) + "k" : ""}</span>
              <div className="w-full rounded-t-lg bg-primary" style={{ height: Math.max(v.kg ? 4 : 0, Math.round((v.kg / maxKg) * 80)) }} />
              <span className="text-xs text-subtle">S{v.week}</span>
            </div>
          ))}
        </div>
      </section>

      <h2 className="mb-2 text-sm font-semibold text-subtle">Ejercicios (1RM estimado, mejor serie de cada semana)</h2>
      {exercises.length === 0 ? (
        <p className="text-subtle">Todavía no hay series con peso y repeticiones.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {exercises.map((e) => (
            <ExerciseRow key={e.name} e={e} />
          ))}
        </ul>
      )}
    </>
  );
}

function ExerciseRow({ e }: { e: ExerciseProgress }) {
  const max = Math.max(...e.weeks.map((w) => w.e1rm));
  const min = Math.min(...e.weeks.map((w) => w.e1rm));
  return (
    <li className="rounded-2xl bg-card p-4">
      <details>
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3">
          <div className="flex-1">
            <p className="font-medium">{e.name}</p>
            <p className="text-xs text-subtle">
              {e.pr && (
                <span className="inline-flex items-center gap-1">
                  <Trophy size={12} /> {fmtNum(e.pr.weight)} × {fmtNum(e.pr.reps)} (S{e.pr.week})
                </span>
              )}
            </p>
          </div>
          <Spark values={e.weeks.map((w) => w.e1rm)} min={min} max={max} />
          <span className={`w-14 text-right text-sm font-semibold tabular-nums ${e.change === null ? "text-subtle" : e.change >= 0 ? "text-primary" : "text-danger"}`}>
            {e.change === null ? "—" : `${e.change > 0 ? "+" : ""}${fmtNum(Math.round(e.change * 10) / 10)}%`}
          </span>
        </summary>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-subtle">
              <th className="py-1 font-medium">Semana</th>
              <th className="py-1 font-medium">Mejor serie</th>
              <th className="py-1 text-right font-medium">1RM est.</th>
            </tr>
          </thead>
          <tbody>
            {e.weeks.map((w) => (
              <tr key={w.week} className="border-t border-border">
                <td className="py-1">S{w.week}</td>
                <td className="py-1">
                  {fmtNum(w.weight)} kg × {fmtNum(w.reps)}
                </td>
                <td className="py-1 text-right tabular-nums">{fmtNum(Math.round(w.e1rm * 10) / 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </li>
  );
}

// Mini gráfica de línea sin ejes.
function Spark({ values, min, max }: { values: number[]; min: number; max: number }) {
  if (values.length < 2) return <span className="w-16" />;
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 60 + 2},${22 - ((v - min) / span) * 20}`).join(" ");
  return (
    <svg width="64" height="24" viewBox="0 0 64 24" aria-hidden="true" className="shrink-0 text-primary">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
