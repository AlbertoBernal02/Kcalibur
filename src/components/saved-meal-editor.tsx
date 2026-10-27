"use client";

import { ChevronLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { foodLabel, type Food } from "@/lib/data/foods";
import { createSavedMeal, deleteSavedMeal, getSavedMeal, updateSavedMeal, type Kind, type SavedItem } from "@/lib/data/saved-meals";
import { MEALS, type Meal } from "@/lib/meals";
import { mealTotals, perServing } from "@/lib/recipes";
import { currentUserId, createClient } from "@/lib/supabase/client";
import { FoodPicker } from "@/components/food-picker";
import { DishForm } from "@/components/outside-meal";
import { QuantityForm } from "@/components/quantity-form";
import { Sheet } from "@/components/sheet";
import { Button, Field, Section, inputCls } from "@/components/ui";

type Dialog = { kind: "add"; food: Food | null } | { kind: "edit"; index: number };

const mealName = (m: Meal) => MEALS.find((x) => x.id === m)!.label;

// Crear / editar una comida guardada o receta, o una opción de dieta (si se pasa `dietId`).
export function SavedMealEditor({ id, dietId, dietMeal }: { id?: string; dietId?: string; dietMeal?: Meal }) {
  const router = useRouter();
  const isOption = !!dietId;
  const backHref = isOption ? `/dietas/${dietId}` : "/comidas";
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("meal");
  const [servings, setServings] = useState("1");
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  useEffect(() => {
    if (!id) return;
    getSavedMeal(createClient(), id)
      .then((m) => {
        if (!m) return setError("Comida no encontrada.");
        setName(m.name);
        setKind(m.kind);
        setServings(String(m.servings));
        setItems(m.items);
      })
      .catch(() => setError("No se pudo cargar la comida."))
      .finally(() => setLoading(false));
  }, [id]);

  const nServings = kind === "recipe" ? Number(servings.replace(",", ".")) : 1;
  const totals = mealTotals(items);
  const per = perServing(items, nServings);
  const close = () => setDialog(null);

  async function run(action: () => Promise<void>, failText: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      router.replace(backHref);
    } catch {
      setError(failText);
      setBusy(false);
    }
  }

  function save() {
    if (!name.trim()) return setError("Ponle un nombre.");
    if (items.length === 0) return setError("Añade al menos un alimento.");
    if (kind === "recipe" && !(nServings > 0 && nServings <= 100)) return setError("Las raciones deben estar entre 0 y 100.");
    // Al editar no se tocan los campos de dieta (la opción no cambia de dieta ni de comida).
    const meal = { name: name.trim(), kind, servings: nServings, dietId: dietId ?? null, dietMeal: dietMeal ?? null, items };
    run(async () => {
      const userId = await currentUserId();
      if (id) await updateSavedMeal(createClient(), userId, id, meal);
      else await createSavedMeal(createClient(), userId, meal);
    }, "No se pudo guardar.");
  }

  function remove() {
    if (!id || !confirm(`¿Borrar "${name}"? Esta acción no se puede deshacer.`)) return;
    run(() => deleteSavedMeal(createClient(), id), "No se pudo borrar.");
  }

  const editing = dialog?.kind === "edit" ? items[dialog.index] : null;

  return (
    <>
      <Link href={backHref} className="mb-4 -ml-2 inline-flex h-12 items-center gap-1 px-2 text-primary">
        <ChevronLeft size={22} /> {isOption ? "Dieta" : "Comidas"}
      </Link>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">
        {isOption
          ? id ? "Editar opción" : `Nueva opción${dietMeal ? ` · ${mealName(dietMeal)}` : ""}`
          : id ? "Editar comida" : "Nueva comida"}
      </h1>

      {loading ? (
        <div className="h-64 animate-pulse rounded-3xl bg-muted" aria-label="Cargando comida" />
      ) : id && !name && error ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-danger">{error}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <Field label="Nombre">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={isOption ? "Ej. Opción con tostadas" : "Ej. Desayuno de siempre"} />
          </Field>
          {!isOption && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo">
                <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                  <option value="meal">Comida guardada</option>
                  <option value="recipe">Receta</option>
                </select>
              </Field>
              {kind === "recipe" && (
                <Field label="Raciones">
                  <input className={inputCls} inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} />
                </Field>
              )}
            </div>
          )}

          <Section title={`Alimentos (${items.length})`}>
            {items.length > 0 && (
              <ul className="flex flex-col gap-2">
                {items.map((it, i) => (
                  <li key={i}>
                    <button onClick={() => setDialog({ kind: "edit", index: i })} className="flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left active:scale-[0.99]">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{it.name}</span>
                        <span className="block text-sm text-subtle">{it.external ? "Comida fuera" : `${it.grams} g`}</span>
                      </span>
                      <span className="font-semibold">{Math.round(it.kcal)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Button type="button" variant="secondary" onClick={() => setDialog({ kind: "add", food: null })} className="flex items-center justify-center gap-2">
              <Plus size={20} /> Añadir alimento
            </Button>
          </Section>

          {items.length > 0 && (
            <div className="rounded-3xl bg-card p-4">
              <p className="text-sm text-subtle">{kind === "recipe" ? "Receta completa" : "Total"}{totals.grams - items.filter((i) => i.external).length > 0 && ` · ${Math.round(totals.grams - items.filter((i) => i.external).length)} g`}</p>
              <p className="text-2xl font-bold">{Math.round(totals.kcal)} <span className="text-base font-medium text-subtle">kcal</span></p>
              <p className="text-sm text-subtle">P {Math.round(totals.protein_g)} · H {Math.round(totals.carbs_g)} · G {Math.round(totals.fat_g)}</p>
              {kind === "recipe" && nServings > 0 && (
                <p className="mt-2 border-t border-border pt-2 text-sm">
                  <span className="font-semibold">Por ración ({nServings}):</span> {Math.round(per.kcal)} kcal · P {Math.round(per.protein_g)} · H {Math.round(per.carbs_g)} · G {Math.round(per.fat_g)}
                </p>
              )}
            </div>
          )}

          {error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
          <Button onClick={save} disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
          {id && <Button variant="secondary" className="text-danger" onClick={remove} disabled={busy}>Borrar</Button>}
        </div>
      )}

      {dialog?.kind === "add" && (
        <Sheet title="Añadir alimento" onClose={close}>
          {dialog.food ? (
            <>
              <button onClick={() => setDialog({ kind: "add", food: null })} className="mb-3 h-10 text-sm font-medium text-primary">← Cambiar alimento</button>
              <QuantityForm
                name={foodLabel(dialog.food)}
                per100={{ kcal: dialog.food.kcal_100g, protein_g: dialog.food.protein_100g, carbs_g: dialog.food.carbs_100g, fat_g: dialog.food.fat_100g }}
                servingG={dialog.food.serving_g}
                submitLabel="Añadir"
                onSubmit={(grams, servingG, m) => {
                  setItems((p) => [...p, { food_id: dialog.food!.id, name: foodLabel(dialog.food!), grams, serving_g: servingG, ...m }]);
                  close();
                }}
              />
            </>
          ) : (
            <FoodPicker onPick={(food) => setDialog({ kind: "add", food })} />
          )}
        </Sheet>
      )}

      {editing && dialog?.kind === "edit" && (
        <Sheet title="Editar alimento" onClose={close}>
          {editing.external ? (
            <DishForm
              initial={editing}
              submitLabel="Guardar"
              onSubmit={(d) => {
                setItems((p) => p.map((x, i) => (i === dialog.index ? { ...x, ...d } : x)));
                close();
              }}
              onDelete={() => {
                setItems((p) => p.filter((_, i) => i !== dialog.index));
                close();
              }}
            />
          ) : (
          <QuantityForm
            name={editing.name}
            per100={{
              kcal: (editing.kcal / editing.grams) * 100, protein_g: (editing.protein_g / editing.grams) * 100,
              carbs_g: (editing.carbs_g / editing.grams) * 100, fat_g: (editing.fat_g / editing.grams) * 100,
            }}
            servingG={editing.serving_g}
            initialGrams={editing.grams}
            submitLabel="Guardar"
            onSubmit={(grams, servingG, m) => {
              setItems((p) => p.map((x, i) => (i === dialog.index ? { ...x, grams, serving_g: servingG, ...m } : x)));
              close();
            }}
            onDelete={() => {
              setItems((p) => p.filter((_, i) => i !== dialog.index));
              close();
            }}
          />
          )}
        </Sheet>
      )}
    </>
  );
}
