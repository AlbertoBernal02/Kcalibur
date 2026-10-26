"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { listSavedMeals, type SavedMeal } from "@/lib/data/saved-meals";
import { mealTotals, perServing } from "@/lib/recipes";
import { createClient } from "@/lib/supabase/client";

// Listado de comidas guardadas y recetas.
export function SavedMealsList() {
  const [meals, setMeals] = useState<SavedMeal[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    listSavedMeals(createClient()).then(setMeals).catch(() => setError(true));
  }, []);

  return (
    <>
      {error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">No se pudieron cargar tus comidas.</p>}

      {!meals && !error ? (
        <div className="flex flex-col gap-2" aria-label="Cargando comidas">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : meals && meals.length === 0 ? (
        <div className="mt-10 text-center text-subtle">
          <p>Aún no tienes comidas guardadas.</p>
          <p className="mt-1 text-sm">Crea una con el botón + o guarda una comida desde el diario.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 pb-20">
          {meals?.map((m) => {
            const recipe = m.kind === "recipe";
            const kcal = Math.round(recipe ? perServing(m.items, m.servings).kcal : mealTotals(m.items).kcal);
            return (
              <li key={m.id}>
                <Link href={`/comidas/${m.id}`} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="truncate">{m.name}</span>
                      <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                        {recipe ? "Receta" : "Comida"}
                      </span>
                    </span>
                    <span className="block truncate text-sm text-subtle">
                      {m.items.length} {m.items.length === 1 ? "alimento" : "alimentos"}
                      {recipe && ` · ${m.servings} ${m.servings === 1 ? "ración" : "raciones"}`}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-semibold">{kcal} kcal</span>
                    {recipe && <span className="block text-xs text-subtle">por ración</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href="/comidas/nueva"
        aria-label="Crear comida"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-fg shadow-lg transition active:scale-95"
      >
        <Plus size={28} />
      </Link>
    </>
  );
}
