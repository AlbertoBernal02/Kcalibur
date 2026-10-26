"use client";

import { ChevronLeft, ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { copyEntries, deleteEntry, loadDay, updateEntry, type Entry } from "@/lib/data/diary";
import { loadGoals } from "@/lib/data/profile";
import { createSavedMeal, entriesToItems } from "@/lib/data/saved-meals";
import type { Goals } from "@/lib/nutrition";
import { MEALS, addDays, dayLabel, longDate, relativeLabel, toISO, type Meal } from "@/lib/meals";
import { getSyncState, subscribeSync } from "@/lib/offline/sync";
import { createClient, currentUserId } from "@/lib/supabase/client";
import { AddToMealSheet } from "@/components/add-to-meal-sheet";
import { DaySummary } from "@/components/day-summary";
import { QuantityForm } from "@/components/quantity-form";
import { Sheet } from "@/components/sheet";
import { Button, Field, inputCls } from "@/components/ui";

type Dialog =
  | { kind: "add"; meal: Meal }
  | { kind: "edit"; entry: Entry }
  | { kind: "copyMeal"; meal: Meal }
  | { kind: "menu" };

const mealLabel = (m: Meal) => MEALS.find((x) => x.id === m)!.label;
const sum = (list: Entry[], k: "kcal" | "protein_g" | "carbs_g" | "fat_g") => list.reduce((a, e) => a + e[k], 0);

// "Hoy" se calcula tras montar: la página se prerrenderiza en el build y el servidor
// no conoce ni la fecha ni la zona horaria del usuario (evita errores de hidratación).
export function Diary() {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(toISO(new Date()));
  }, []);
  if (!today) return <div className="h-64 animate-pulse rounded-3xl bg-muted" aria-label="Cargando diario" />;
  return <DiaryDay today={today} />;
}

function DiaryDay({ today }: { today: string }) {
  const [date, setDate] = useState(today);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  // Abrir/cerrar un diálogo limpia cualquier error anterior.
  const open = useCallback((d: Dialog) => {
    setError(null);
    setDialog(d);
  }, []);
  const close = useCallback(() => {
    setError(null);
    setDialog(null);
  }, []);

  const reload = useCallback(async (d: string) => setEntries(await loadDay(createClient(), d)), []);

  // Objetivos diarios: se cargan una vez (si falla, el resumen muestra solo totales).
  useEffect(() => {
    loadGoals(createClient()).then(setGoals).catch(() => setGoals(null));
  }, []);

  // Al terminar una sincronización offline->servidor se recarga el día (el servidor puede haber rechazado algo).
  const wasSyncing = useRef(false);
  useEffect(
    () =>
      subscribeSync(() => {
        const s = getSyncState();
        const finished = wasSyncing.current && !s.syncing;
        wasSyncing.current = s.syncing;
        if (finished) reload(date).catch(() => undefined);
      }),
    [date, reload],
  );

  // Carga el día; `stale` evita pisar el resultado si se cambia de día rápido.
  useEffect(() => {
    let stale = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    loadDay(createClient(), date)
      .then((r) => !stale && setEntries(r))
      .catch(() => !stale && setError("No se pudo cargar el día. Revisa la conexión."))
      .finally(() => !stale && setLoading(false));
    return () => {
      stale = true;
    };
  }, [date]);

  // Ejecuta una escritura, recarga el día y cierra el diálogo; muestra el error si falla.
  // `okText` muestra un aviso breve de confirmación al terminar.
  async function mutate(action: () => Promise<void>, failText: string, okText?: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload(date);
      setDialog(null);
      if (okText) {
        setNotice(okText);
        setTimeout(() => setNotice(null), 3500);
      }
    } catch {
      setError(failText);
    } finally {
      setBusy(false);
    }
  }

  const byMeal = useMemo(() => MEALS.map((m) => ({ ...m, items: entries.filter((e) => e.meal === m.id) })), [entries]);

  async function copyPreviousDay() {
    await mutate(async () => {
      const prev = await loadDay(createClient(), addDays(date, -1));
      if (prev.length === 0) throw new Error("vacío");
      await copyEntries(createClient(), prev, date);
    }, "El día anterior no tiene entradas o no se pudo copiar.");
  }

  return (
    <>
      {/* Navegación entre días */}
      <header className="mb-4 flex items-center gap-1">
        <button onClick={() => setDate(addDays(date, -1))} aria-label="Día anterior" className="flex h-12 w-12 items-center justify-center rounded-full text-subtle active:bg-muted">
          <ChevronLeft size={26} />
        </button>
        <div className="relative flex-1 text-center">
          <h1 className="text-2xl font-bold capitalize tracking-tight">{dayLabel(date, today)}</h1>
          <p className="text-xs text-subtle">
            {relativeLabel(date, today) ? longDate(date, true) : date.slice(0, 4)}
          </p>
          {/* El input de fecha cubre el título: tocarlo abre el selector nativo */}
          <input type="date" aria-label="Elegir fecha" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="absolute inset-0 h-full w-full opacity-0" />
        </div>
        <button onClick={() => setDate(addDays(date, 1))} aria-label="Día siguiente" className="flex h-12 w-12 items-center justify-center rounded-full text-subtle active:bg-muted">
          <ChevronRight size={26} />
        </button>
        <button onClick={() => open({ kind: "menu" })} aria-label="Más opciones" className="flex h-12 w-12 items-center justify-center rounded-full text-subtle active:bg-muted">
          <MoreHorizontal size={24} />
        </button>
      </header>

      {date !== today && (
        <button onClick={() => setDate(today)} className="mb-4 h-10 w-full rounded-xl bg-muted text-sm font-medium text-primary">
          Volver a hoy
        </button>
      )}

      {notice && <p role="status" className="mb-4 rounded-xl bg-primary/10 px-4 py-3 text-sm text-primary">{notice}</p>}

      {/* Con un diálogo abierto el error se muestra dentro de él */}
      {error && !dialog && <p role="alert" className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      {/* Resumen del día frente a los objetivos */}
      {loading ? <div className="mb-5 h-44 animate-pulse rounded-3xl bg-muted" /> : <DaySummary entries={entries} goals={goals} />}

      {loading ? (
        <div className="flex flex-col gap-3" aria-label="Cargando diario">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-3xl bg-muted" />)}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {byMeal.map((m) => (
            <section key={m.id} aria-label={m.label} className="rounded-3xl bg-card">
              <div className="flex items-center px-4 pt-3">
                <h2 className="flex-1 font-semibold">{m.label}</h2>
                <span className="mr-2 text-sm text-subtle">{Math.round(sum(m.items, "kcal"))} kcal</span>
                {m.items.length > 0 && (
                  <button onClick={() => open({ kind: "copyMeal", meal: m.id })} aria-label={`Opciones de ${m.label}`} className="flex h-11 w-11 items-center justify-center rounded-full text-subtle active:bg-muted">
                    <MoreHorizontal size={20} />
                  </button>
                )}
                <button onClick={() => open({ kind: "add", meal: m.id })} aria-label={`Añadir a ${m.label}`} className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-fg active:scale-95">
                  <Plus size={22} />
                </button>
              </div>
              <ul className="px-2 pb-2 pt-1">
                {m.items.map((e) => (
                  <li key={e.id}>
                    <button onClick={() => open({ kind: "edit", entry: e })} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left active:bg-muted">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{e.name}</span>
                        <span className="block text-sm text-subtle">{e.grams} g · P {Math.round(e.protein_g)} · H {Math.round(e.carbs_g)} · G {Math.round(e.fat_g)}</span>
                      </span>
                      <span className="font-semibold">{Math.round(e.kcal)}</span>
                    </button>
                  </li>
                ))}
                {m.items.length === 0 && <li className="px-2 pb-2 pt-1 text-sm text-subtle">Nada todavía</li>}
              </ul>
            </section>
          ))}
        </div>
      )}

      {dialog?.kind === "menu" && (
        <Sheet title="Opciones del día" onClose={close} error={error}>
          <Button variant="secondary" onClick={copyPreviousDay} disabled={busy}>Copiar el día anterior aquí</Button>
        </Sheet>
      )}

      {dialog?.kind === "add" && (
        <AddToMealSheet meal={dialog.meal} date={date} busy={busy} error={error} onClose={close} onWrite={mutate} />
      )}

      {dialog?.kind === "edit" && (
        <EditSheet
          entry={dialog.entry}
          busy={busy}
          error={error}
          onClose={close}
          onSave={(patch) => mutate(() => updateEntry(createClient(), dialog.entry.id, patch), "No se pudo guardar el cambio.")}
          onDelete={() => mutate(() => deleteEntry(createClient(), dialog.entry.id), "No se pudo borrar la entrada.")}
        />
      )}

      {dialog?.kind === "copyMeal" && (
        <CopyMealSheet
          meal={dialog.meal}
          fromDate={date}
          busy={busy}
          error={error}
          onClose={close}
          onCopy={(toDate, toMeal) =>
            mutate(async () => {
              const items = entries.filter((e) => e.meal === dialog.meal);
              await copyEntries(createClient(), items, toDate, toMeal);
            }, "No se pudo copiar la comida.")
          }
          onSaveAsMeal={(name) =>
            mutate(
              async () => {
                const items = entriesToItems(entries.filter((e) => e.meal === dialog.meal));
                await createSavedMeal(createClient(), await currentUserId(), { name, kind: "meal", servings: 1, items });
              },
              "No se pudo guardar la comida.",
              `«${name}» guardada en Comidas ✓`,
            )
          }
        />
      )}
    </>
  );
}

// Edición de una entrada: cantidad (con macros recalculados) y comida.
function EditSheet({ entry, busy, error, onClose, onSave, onDelete }: {
  entry: Entry; busy: boolean; error: string | null; onClose: () => void;
  onSave: (patch: Partial<Omit<Entry, "id">>) => void; onDelete: () => void;
}) {
  const [meal, setMeal] = useState<Meal>(entry.meal);
  // Valores por 100 g derivados de lo guardado (el cálculo es lineal).
  const per = (v: number) => (v / entry.grams) * 100;
  return (
    <Sheet title="Editar entrada" onClose={onClose} error={error}>
      <div className="mb-4">
        <Field label="Comida">
          <select className={inputCls} value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEALS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </Field>
      </div>
      <QuantityForm
        name={entry.name}
        per100={{ kcal: per(entry.kcal), protein_g: per(entry.protein_g), carbs_g: per(entry.carbs_g), fat_g: per(entry.fat_g) }}
        servingG={entry.serving_g}
        initialGrams={entry.grams}
        submitLabel="Guardar"
        busy={busy}
        onSubmit={(grams, servingG, m) => onSave({ meal, grams, serving_g: servingG, ...m })}
        onDelete={() => confirm("¿Borrar esta entrada?") && onDelete()}
      />
    </Sheet>
  );
}

// Opciones de una comida: copiarla a otro día/comida o guardarla como comida reutilizable.
function CopyMealSheet({ meal, fromDate, busy, error, onClose, onCopy, onSaveAsMeal }: {
  meal: Meal; fromDate: string; busy: boolean; error: string | null; onClose: () => void;
  onCopy: (date: string, meal: Meal) => void; onSaveAsMeal: (name: string) => void;
}) {
  const [toDate, setToDate] = useState(addDays(fromDate, 1));
  const [toMeal, setToMeal] = useState<Meal>(meal);
  const [name, setName] = useState(mealLabel(meal));
  return (
    <Sheet title={`Opciones de ${mealLabel(meal)}`} onClose={onClose} error={error}>
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-subtle">Copiar a otro día</h3>
        <Field label="Día destino">
          <input type="date" className={inputCls} value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </Field>
        <Field label="Comida destino">
          <select className={inputCls} value={toMeal} onChange={(e) => setToMeal(e.target.value as Meal)}>
            {MEALS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </Field>
        <Button onClick={() => toDate && onCopy(toDate, toMeal)} disabled={busy || !toDate}>{busy ? "Copiando…" : "Copiar"}</Button>

        <h3 className="mt-2 border-t border-border pt-4 text-sm font-semibold text-subtle">Guardar como comida</h3>
        <Field label="Nombre">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <Button variant="secondary" onClick={() => onSaveAsMeal(name.trim())} disabled={busy || !name.trim()}>Guardar como comida</Button>
      </div>
    </Sheet>
  );
}
