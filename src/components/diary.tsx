"use client";

import { ChevronLeft, ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { addEntry, copyEntries, deleteEntry, loadDay, updateEntry, type Entry } from "@/lib/data/diary";
import { foodLabel, type Food } from "@/lib/data/foods";
import { MEALS, addDays, dayLabel, toISO, type Meal } from "@/lib/meals";
import { createClient, currentUserId } from "@/lib/supabase/client";
import { FoodPicker } from "@/components/food-picker";
import { QuantityForm } from "@/components/quantity-form";
import { Sheet } from "@/components/sheet";
import { Button, Field, inputCls } from "@/components/ui";

type Dialog =
  | { kind: "add"; meal: Meal; food: Food | null }
  | { kind: "edit"; entry: Entry }
  | { kind: "copyMeal"; meal: Meal }
  | { kind: "menu" };

const mealLabel = (m: Meal) => MEALS.find((x) => x.id === m)!.label;
const sum = (list: Entry[], k: "kcal" | "protein_g" | "carbs_g" | "fat_g") => list.reduce((a, e) => a + e[k], 0);

export function Diary() {
  const [date, setDate] = useState(() => toISO(new Date()));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const close = useCallback(() => setDialog(null), []);

  const reload = useCallback(async (d: string) => setEntries(await loadDay(createClient(), d)), []);

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
  async function mutate(action: () => Promise<void>, failText: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload(date);
      setDialog(null);
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
      await copyEntries(createClient(), await currentUserId(), prev, date);
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
          <h1 className="text-2xl font-bold capitalize tracking-tight">{dayLabel(date)}</h1>
          <p className="text-xs text-subtle">{date}</p>
          {/* El input de fecha cubre el título: tocarlo abre el selector nativo */}
          <input type="date" aria-label="Elegir fecha" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="absolute inset-0 h-full w-full opacity-0" />
        </div>
        <button onClick={() => setDate(addDays(date, 1))} aria-label="Día siguiente" className="flex h-12 w-12 items-center justify-center rounded-full text-subtle active:bg-muted">
          <ChevronRight size={26} />
        </button>
        <button onClick={() => setDialog({ kind: "menu" })} aria-label="Más opciones" className="flex h-12 w-12 items-center justify-center rounded-full text-subtle active:bg-muted">
          <MoreHorizontal size={24} />
        </button>
      </header>

      {date !== toISO(new Date()) && (
        <button onClick={() => setDate(toISO(new Date()))} className="mb-4 h-10 w-full rounded-xl bg-muted text-sm font-medium text-primary">
          Volver a hoy
        </button>
      )}

      {error && <p role="alert" className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      {/* Totales del día */}
      <div className="mb-5 grid grid-cols-4 gap-2 rounded-3xl bg-card p-4 text-center">
        <Total label="kcal" value={sum(entries, "kcal")} color="text-foreground" />
        <Total label="Prot." value={sum(entries, "protein_g")} color="text-protein" />
        <Total label="Hidr." value={sum(entries, "carbs_g")} color="text-carbs" />
        <Total label="Grasa" value={sum(entries, "fat_g")} color="text-fat" />
      </div>

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
                  <button onClick={() => setDialog({ kind: "copyMeal", meal: m.id })} aria-label={`Copiar ${m.label}`} className="flex h-11 w-11 items-center justify-center rounded-full text-subtle active:bg-muted">
                    <MoreHorizontal size={20} />
                  </button>
                )}
                <button onClick={() => setDialog({ kind: "add", meal: m.id, food: null })} aria-label={`Añadir a ${m.label}`} className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-fg active:scale-95">
                  <Plus size={22} />
                </button>
              </div>
              <ul className="px-2 pb-2 pt-1">
                {m.items.map((e) => (
                  <li key={e.id}>
                    <button onClick={() => setDialog({ kind: "edit", entry: e })} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left active:bg-muted">
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
        <Sheet title="Opciones del día" onClose={close}>
          <Button variant="secondary" onClick={copyPreviousDay} disabled={busy}>Copiar el día anterior aquí</Button>
        </Sheet>
      )}

      {dialog?.kind === "add" && (
        <Sheet title={`Añadir a ${mealLabel(dialog.meal)}`} onClose={close}>
          {dialog.food ? (
            <>
              <button onClick={() => setDialog({ ...dialog, food: null })} className="mb-3 h-10 text-sm font-medium text-primary">← Cambiar alimento</button>
              <QuantityForm
                name={foodLabel(dialog.food)}
                per100={{ kcal: dialog.food.kcal_100g, protein_g: dialog.food.protein_100g, carbs_g: dialog.food.carbs_100g, fat_g: dialog.food.fat_100g }}
                servingG={dialog.food.serving_g}
                submitLabel="Añadir"
                busy={busy}
                onSubmit={(grams, servingG, m) => {
                  const food = dialog.food!;
                  mutate(async () => addEntry(createClient(), await currentUserId(), {
                    entry_date: date, meal: dialog.meal, food_id: food.id, name: foodLabel(food),
                    grams, serving_g: servingG, ...m,
                  }), "No se pudo añadir la entrada.");
                }}
              />
            </>
          ) : (
            <FoodPicker onPick={(food) => setDialog({ ...dialog, food })} />
          )}
        </Sheet>
      )}

      {dialog?.kind === "edit" && (
        <EditSheet
          entry={dialog.entry}
          busy={busy}
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
          onClose={close}
          onCopy={(toDate, toMeal) =>
            mutate(async () => {
              const items = entries.filter((e) => e.meal === dialog.meal);
              await copyEntries(createClient(), await currentUserId(), items, toDate, toMeal);
            }, "No se pudo copiar la comida.")
          }
        />
      )}
    </>
  );
}

function Total({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <p className={`text-xl font-bold ${color}`}>{Math.round(value)}</p>
      <p className="text-xs text-subtle">{label}</p>
    </div>
  );
}

// Edición de una entrada: cantidad (con macros recalculados) y comida.
function EditSheet({ entry, busy, onClose, onSave, onDelete }: {
  entry: Entry; busy: boolean; onClose: () => void;
  onSave: (patch: Partial<Omit<Entry, "id">>) => void; onDelete: () => void;
}) {
  const [meal, setMeal] = useState<Meal>(entry.meal);
  // Valores por 100 g derivados de lo guardado (el cálculo es lineal).
  const per = (v: number) => (v / entry.grams) * 100;
  return (
    <Sheet title="Editar entrada" onClose={onClose}>
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

// Copia las entradas de una comida a otro día y/o comida.
function CopyMealSheet({ meal, fromDate, busy, onClose, onCopy }: {
  meal: Meal; fromDate: string; busy: boolean; onClose: () => void; onCopy: (date: string, meal: Meal) => void;
}) {
  const [toDate, setToDate] = useState(addDays(fromDate, 1));
  const [toMeal, setToMeal] = useState<Meal>(meal);
  return (
    <Sheet title={`Copiar ${mealLabel(meal)}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label="Día destino">
          <input type="date" className={inputCls} value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </Field>
        <Field label="Comida destino">
          <select className={inputCls} value={toMeal} onChange={(e) => setToMeal(e.target.value as Meal)}>
            {MEALS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </Field>
        <Button onClick={() => toDate && onCopy(toDate, toMeal)} disabled={busy || !toDate}>{busy ? "Copiando…" : "Copiar"}</Button>
      </div>
    </Sheet>
  );
}
