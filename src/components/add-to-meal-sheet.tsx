"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addEntry } from "@/lib/data/diary";
import { foodLabel, type Food } from "@/lib/data/foods";
import { addMealToDiary, listSavedMeals, type SavedMeal } from "@/lib/data/saved-meals";
import { MEALS, type Meal } from "@/lib/meals";
import { mealTotals, perServing, recipePer100, servingGrams } from "@/lib/recipes";
import { createClient, currentUserId } from "@/lib/supabase/client";
import { FoodPicker } from "@/components/food-picker";
import { QuantityForm } from "@/components/quantity-form";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui";

type Props = {
  meal: Meal;
  date: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  // Ejecuta la escritura con control de estado/errores (mutate del diario).
  onWrite: (action: () => Promise<void>, failText: string, okText?: string) => void;
};

// Hoja para añadir a una comida: un alimento (gramos/raciones) o una comida guardada / receta.
export function AddToMealSheet({ meal, date, busy, error, onClose, onWrite }: Props) {
  const [mode, setMode] = useState<"foods" | "saved">("foods");
  const [food, setFood] = useState<Food | null>(null);
  const [saved, setSaved] = useState<SavedMeal | null>(null);
  const label = MEALS.find((m) => m.id === meal)!.label;
  const back = () => {
    setFood(null);
    setSaved(null);
  };

  return (
    <Sheet title={`Añadir a ${label}`} onClose={onClose} error={error}>
      {food ? (
        <>
          <button onClick={back} className="mb-3 h-10 text-sm font-medium text-primary">← Cambiar alimento</button>
          <QuantityForm
            name={foodLabel(food)}
            per100={{ kcal: food.kcal_100g, protein_g: food.protein_100g, carbs_g: food.carbs_100g, fat_g: food.fat_100g }}
            servingG={food.serving_g}
            submitLabel="Añadir"
            busy={busy}
            onSubmit={(grams, servingG, m) =>
              onWrite(async () => addEntry(createClient(), await currentUserId(), {
                entry_date: date, meal, food_id: food.id, name: foodLabel(food), grams, serving_g: servingG, ...m,
              }), "No se pudo añadir la entrada.")
            }
          />
        </>
      ) : saved ? (
        <>
          <button onClick={back} className="mb-3 h-10 text-sm font-medium text-primary">← Cambiar comida</button>
          {saved.kind === "recipe" ? (
            <QuantityForm
              name={saved.name}
              per100={recipePer100(saved.items)}
              servingG={servingGrams(saved.items, saved.servings)}
              initialUnit="serving"
              submitLabel="Añadir"
              busy={busy}
              onSubmit={(grams, servingG, m) =>
                onWrite(async () => addEntry(createClient(), await currentUserId(), {
                  entry_date: date, meal, food_id: null, name: saved.name, grams, serving_g: servingG, ...m,
                }), "No se pudo añadir la receta.")
              }
            />
          ) : (
            <SavedMealSummary
              saved={saved}
              busy={busy}
              label={label}
              onAdd={() =>
                onWrite(async () => addMealToDiary(createClient(), await currentUserId(), saved.items, date, meal), "No se pudo añadir la comida.")
              }
            />
          )}
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex rounded-2xl bg-muted p-1" role="tablist" aria-label="Origen">
            {([["foods", "Alimentos"], ["saved", "Mis comidas"]] as const).map(([id, text]) => (
              <button
                key={id}
                role="tab"
                aria-selected={mode === id}
                onClick={() => setMode(id)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition ${mode === id ? "bg-card text-foreground shadow-sm" : "text-subtle"}`}
              >
                {text}
              </button>
            ))}
          </div>
          {mode === "foods" ? <FoodPicker onPick={setFood} /> : <SavedMealPicker onPick={setSaved} />}
        </div>
      )}
    </Sheet>
  );
}

// Lista de comidas guardadas y recetas para elegir.
function SavedMealPicker({ onPick }: { onPick: (m: SavedMeal) => void }) {
  const [meals, setMeals] = useState<SavedMeal[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    listSavedMeals(createClient()).then(setMeals).catch(() => setError(true));
  }, []);

  if (error) return <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">No se pudieron cargar tus comidas.</p>;
  if (!meals) return <div className="h-16 animate-pulse rounded-2xl bg-muted" aria-label="Cargando comidas" />;
  if (meals.length === 0)
    return (
      <p className="py-8 text-center text-sm text-subtle">
        Aún no tienes comidas guardadas.{" "}
        <Link href="/comidas/nueva" className="font-semibold text-primary">Crea una</Link>
      </p>
    );

  return (
    <ul className="flex flex-col gap-2">
      {meals.map((m) => {
        const recipe = m.kind === "recipe";
        const kcal = Math.round(recipe ? perServing(m.items, m.servings).kcal : mealTotals(m.items).kcal);
        return (
          <li key={m.id}>
            <button onClick={() => onPick(m)} className="flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left transition active:scale-[0.99]">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{m.name}</span>
                <span className="block text-sm text-subtle">
                  {recipe ? `Receta · ${m.servings} raciones` : `${m.items.length} alimentos`}
                </span>
              </span>
              <span className="font-semibold">{kcal} kcal{recipe && <span className="text-xs font-normal text-subtle"> /ración</span>}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// Detalle de una comida guardada antes de añadirla (se añade un elemento por alimento).
function SavedMealSummary({ saved, busy, label, onAdd }: { saved: SavedMeal; busy: boolean; label: string; onAdd: () => void }) {
  const t = mealTotals(saved.items);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg font-semibold">{saved.name}</p>
      <ul className="flex flex-col gap-1.5 rounded-2xl bg-card p-3 text-sm">
        {saved.items.map((it, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span className="min-w-0 truncate">{it.name} <span className="text-subtle">· {it.grams} g</span></span>
            <span className="font-medium">{Math.round(it.kcal)}</span>
          </li>
        ))}
      </ul>
      <p className="text-center text-sm text-subtle">
        Total {Math.round(t.kcal)} kcal · P {Math.round(t.protein_g)} · H {Math.round(t.carbs_g)} · G {Math.round(t.fat_g)}
      </p>
      <Button onClick={onAdd} disabled={busy}>{busy ? "Añadiendo…" : `Añadir a ${label}`}</Button>
    </div>
  );
}
