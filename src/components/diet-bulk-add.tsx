"use client";

import { useState } from "react";
import { addItemToOptions } from "@/lib/data/diets";
import { foodLabel, type Food } from "@/lib/data/foods";
import type { SavedItem, SavedMeal } from "@/lib/data/saved-meals";
import { MEALS } from "@/lib/meals";
import { servingNamesFor } from "@/lib/serving";
import { createClient, currentUserId } from "@/lib/supabase/client";
import { FoodPicker } from "@/components/food-picker";
import { QuantityForm } from "@/components/quantity-form";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui";

// Añade un mismo alimento (p. ej. AOVE para la sartén) a varias opciones de la dieta de una vez:
// 1) elegir alimento, 2) cantidad, 3) marcar en qué opciones va.
export function DietBulkAddSheet({ options, onClose, onDone }: { options: SavedMeal[]; onClose: () => void; onDone: (count: number) => void }) {
  const [food, setFood] = useState<Food | null>(null);
  const [item, setItem] = useState<SavedItem | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  async function apply() {
    if (!item || picked.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      await addItemToOptions(createClient(), await currentUserId(), [...picked], item);
      onDone(picked.size);
    } catch {
      setError("No se pudo añadir. Comprueba la conexión e inténtalo de nuevo.");
      setBusy(false);
    }
  }

  return (
    <Sheet title="Añadir a varias opciones" onClose={onClose} error={error}>
      {!food ? (
        <FoodPicker onPick={setFood} />
      ) : !item ? (
        <>
          <button onClick={() => setFood(null)} className="mb-3 h-10 text-sm font-medium text-primary">← Cambiar alimento</button>
          <QuantityForm
            name={foodLabel(food)}
            per100={{ kcal: food.kcal_100g, protein_g: food.protein_100g, carbs_g: food.carbs_100g, fat_g: food.fat_100g }}
            servingG={food.serving_g}
            initialUnit={servingNamesFor(food) ? "serving" : undefined}
            servingNames={servingNamesFor(food)}
            submitLabel="Siguiente"
            onSubmit={(grams, servingG, m) => setItem({ food_id: food.id, name: foodLabel(food), grams, serving_g: servingG, ...m })}
          />
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <button onClick={() => setItem(null)} className="h-10 self-start text-sm font-medium text-primary">← Cambiar cantidad</button>
          <p className="rounded-2xl bg-card px-4 py-3">
            <span className="block font-semibold">{item.name}</span>
            <span className="text-sm text-subtle">{item.grams} g · {Math.round(item.kcal * 10) / 10} kcal</span>
          </p>

          <div className="flex gap-2 text-sm font-medium">
            <button onClick={() => setPicked(new Set(options.map((o) => o.id)))} className="h-10 flex-1 rounded-xl bg-muted">Todas</button>
            <button onClick={() => setPicked(new Set())} className="h-10 flex-1 rounded-xl bg-muted">Ninguna</button>
          </div>

          {MEALS.map((m) => {
            const opts = options.filter((o) => o.dietMeal === m.id);
            if (opts.length === 0) return null;
            return (
              <fieldset key={m.id} className="flex flex-col gap-1">
                <legend className="mb-1 text-sm font-semibold text-subtle">{m.label}</legend>
                {opts.map((o) => (
                  <label key={o.id} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 text-sm">
                    <input type="checkbox" checked={picked.has(o.id)} onChange={() => toggle(o.id)} className="h-5 w-5 shrink-0 accent-primary" />
                    <span className="min-w-0 flex-1 break-words">{o.name}</span>
                  </label>
                ))}
              </fieldset>
            );
          })}

          <Button onClick={apply} disabled={busy || picked.size === 0}>
            {busy ? "Añadiendo…" : picked.size === 0 ? "Marca al menos una opción" : `Añadir a ${picked.size} ${picked.size === 1 ? "opción" : "opciones"}`}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
