"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { addExercise, deleteExercise, updateExercise, type ExerciseData } from "@/lib/data/training";
import { createClient, currentUserId } from "@/lib/supabase/client";
import { applySets, parseRestInput, uniformPlan } from "@/lib/training/edit";
import { fmtClock } from "@/lib/training/log";
import type { PlanSet } from "@/lib/training/types";
import { Sheet } from "@/components/sheet";
import { Button, Field, inputCls } from "@/components/ui";

export type EditTarget = { kind: "edit"; ex: ExerciseData } | { kind: "add"; dayId: string; position: number };

const DEFAULT_SETS: PlanSet[] = [
  { reps: "10", rir: "1" },
  { reps: "10", rir: "1" },
  { reps: "10", rir: "1" },
];

// Hoja para editar o crear un ejercicio: datos generales y series (objetivo) de la semana actual.
export function ExerciseEditor({ target, week, weeks, onDone, onClose }: { target: EditTarget; week: number; weeks: number; onDone: () => Promise<void>; onClose: () => void }) {
  const ex = target.kind === "edit" ? target.ex : null;
  const [name, setName] = useState(ex?.name ?? "");
  const [notes, setNotes] = useState(ex?.notes ?? "");
  const [rest, setRest] = useState(ex?.restSeconds ? fmtClock(ex.restSeconds) : "2:00");
  const [video, setVideo] = useState(ex?.videoUrl ?? "");
  const [sets, setSets] = useState<PlanSet[]>(ex?.plan[week]?.length ? ex.plan[week] : DEFAULT_SETS);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (i: number, patch: Partial<PlanSet>) => setSets((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return setError("Pon un nombre al ejercicio.");
    if (sets.some((s) => !s.reps.trim())) return setError("Cada serie necesita sus repeticiones objetivo (puedes poner «-» o «fallo»).");
    const url = video.trim();
    if (url && !/^https?:\/\//i.test(url)) return setError("El enlace del vídeo debe empezar por http:// o https://");
    const patch = {
      name: trimmed,
      notes: notes.trim(),
      restSeconds: parseRestInput(rest),
      videoUrl: url || null,
      plan: ex ? applySets(ex.plan, week, sets, weeks, following) : uniformPlan(sets, weeks),
    };
    setBusy(true);
    setError(null);
    try {
      const sb = createClient();
      if (target.kind === "edit") await updateExercise(sb, target.ex.id, patch);
      else await addExercise(sb, await currentUserId(), target.dayId, target.position, patch);
      await onDone();
      onClose();
    } catch {
      setError("No se pudo guardar el ejercicio.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!ex || !confirm(`¿Borrar «${ex.name}» y todos sus registros? No se puede deshacer.`)) return;
    setBusy(true);
    try {
      await deleteExercise(createClient(), ex.id);
      await onDone();
      onClose();
    } catch {
      setError("No se pudo borrar el ejercicio.");
      setBusy(false);
    }
  }

  return (
    <Sheet title={ex ? "Editar ejercicio" : "Nuevo ejercicio"} onClose={onClose} error={error}>
      <div className="flex flex-col gap-4">
        <Field label="Nombre">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={160} />
        </Field>
        <Field label="Notas (técnica, ajustes de la máquina…)">
          <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Descanso (m:ss)">
            <input className={inputCls} inputMode="numeric" value={rest} onChange={(e) => setRest(e.target.value)} />
          </Field>
          <Field label="Vídeo (enlace)">
            <input className={inputCls} inputMode="url" value={video} onChange={(e) => setVideo(e.target.value)} />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">{ex ? `Series de la semana ${week}` : "Series (en todas las semanas)"}</p>
          <ul className="flex flex-col gap-2">
            {sets.map((s, i) => (
              <li key={i} className="grid grid-cols-[1.5rem_1fr_5rem_3rem] items-center gap-2">
                <span className="text-sm text-subtle">{i + 1}</span>
                <input className={`${inputCls} h-12`} aria-label={`Repeticiones objetivo de la serie ${i + 1}`} placeholder="Reps" value={s.reps} onChange={(e) => setField(i, { reps: e.target.value })} />
                <input className={`${inputCls} h-12 text-center`} aria-label={`RIR objetivo de la serie ${i + 1}`} placeholder="RIR" inputMode="decimal" value={s.rir} onChange={(e) => setField(i, { rir: e.target.value })} />
                <button onClick={() => setSets((all) => all.filter((_, j) => j !== i))} disabled={sets.length <= 1} aria-label={`Quitar serie ${i + 1}`} className="flex h-12 items-center justify-center text-subtle disabled:opacity-30">
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
          <button onClick={() => setSets((all) => [...all, { ...all[all.length - 1] }])} className="mt-2 flex h-11 items-center gap-1 text-sm font-semibold text-primary">
            <Plus size={18} /> Añadir serie
          </button>
          {ex && weeks > week && (
            <label className="mt-1 flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-[var(--primary)]" checked={following} onChange={(e) => setFollowing(e.target.checked)} />
              Aplicar también a las semanas {week + 1}–{weeks}
            </label>
          )}
        </div>

        <Button disabled={busy} onClick={save}>{busy ? "Guardando…" : "Guardar"}</Button>
        {ex && (
          <Button variant="secondary" disabled={busy} onClick={remove} className="text-danger">
            Borrar ejercicio
          </Button>
        )}
      </div>
    </Sheet>
  );
}
