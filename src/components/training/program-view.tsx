"use client";

import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteProgram, renameDay } from "@/lib/data/training";
import { createClient } from "@/lib/supabase/client";
import { fmtClock } from "@/lib/training/log";
import { Button } from "@/components/ui";
import { ErrorNote, WEEKDAYS } from "./bits";
import { ExerciseEditor, type EditTarget } from "./exercise-editor";
import { ImportProgram } from "./import-program";
import { useProgram } from "./use-program";

// Pantalla "Rutina": todo el programa (días y ejercicios con sus objetivos) + importar otra / borrar.
export function ProgramView() {
  const { program, error, reload } = useProgram();
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (program === undefined) return <div className="h-48 animate-pulse rounded-3xl bg-muted" aria-label="Cargando rutina" />;
  if (program === null) return <ImportProgram onImported={reload} />;

  async function remove() {
    if (!program || !confirm(`¿Borrar la rutina «${program.name}» con todo su histórico? No se puede deshacer.`)) return;
    try {
      await deleteProgram(createClient(), program.id);
      await reload();
    } catch {
      setMsg("No se pudo borrar la rutina.");
    }
  }

  async function rename(id: string, current: string) {
    const name = prompt("Nombre del día", current)?.trim();
    if (!name || name === current) return;
    try {
      await renameDay(createClient(), id, name);
      await reload();
    } catch {
      setMsg("No se pudo renombrar el día.");
    }
  }

  return (
    <>
      <p className="mb-4 text-sm text-subtle">
        {program.name} · {program.weeks} semanas
      </p>
      {msg && <ErrorNote>{msg}</ErrorNote>}
      {program.days.map((d) => (
        <section key={d.id} className="mb-4 rounded-3xl bg-card p-5">
          <p className="text-xs font-semibold text-subtle">{d.weekday ? WEEKDAYS[d.weekday - 1] : "Descanso activo"}</p>
          <div className="flex items-center">
            <h2 className="flex-1 text-lg font-bold">{d.name}</h2>
            <button onClick={() => rename(d.id, d.name)} aria-label={`Renombrar ${d.name}`} className="flex h-11 w-11 items-center justify-center text-subtle">
              <Pencil size={16} />
            </button>
          </div>
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {d.exercises.map((e) => {
              const sets = e.plan[program.currentWeek] ?? [];
              return (
                <li key={e.id} className="flex items-start gap-3 py-2.5">
                  <div className="flex-1">
                    <p className="font-medium">{e.name}</p>
                    <p className="text-xs text-subtle">
                      {sets.length} series{sets[0] ? ` · ${sets[0].reps}` : ""}
                      {e.restSeconds ? ` · descanso ${fmtClock(e.restSeconds)}` : ""}
                    </p>
                  </div>
                  <button onClick={() => setEditing({ kind: "edit", ex: e })} aria-label={`Editar ${e.name}`} className="flex h-11 w-11 items-center justify-center text-subtle">
                    <Pencil size={18} />
                  </button>
                  {e.videoUrl && (
                    <a href={e.videoUrl} target="_blank" rel="noopener noreferrer" aria-label={`Vídeo de ${e.name}`} className="flex h-11 w-11 items-center justify-center text-subtle">
                      <ExternalLink size={18} />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
          <button onClick={() => setEditing({ kind: "add", dayId: d.id, position: d.exercises.length })} className="mt-2 flex h-11 items-center gap-1 text-sm font-semibold text-primary">
            <Plus size={18} /> Añadir ejercicio
          </button>
        </section>
      ))}
      {editing && <ExerciseEditor target={editing} week={program.currentWeek} weeks={program.weeks} onDone={reload} onClose={() => setEditing(null)} />}
      <div className="mt-6 flex flex-col gap-3">
        <ImportProgram replacing onImported={reload} />
        <Button variant="secondary" onClick={remove} className="flex items-center justify-center gap-2 text-danger">
          <Trash2 size={18} /> Borrar esta rutina
        </Button>
      </div>
    </>
  );
}
