"use client";

import { useState } from "react";
import { DietsList } from "@/components/diets-list";
import { SavedMealsList } from "@/components/saved-meals-list";
import { WeekPlan } from "@/components/week-plan";

type Tab = "comidas" | "dietas" | "semana";

// Pestaña Comidas: comidas guardadas / recetas, y dietas. `initialTab` permite volver directo a las dietas.
export function ComidasView({ initialTab }: { initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  return (
    <>
      <div className="mb-4 flex rounded-2xl bg-muted p-1" role="tablist" aria-label="Sección">
        {([["comidas", "Mis comidas"], ["dietas", "Dietas"], ["semana", "Semana"]] as const).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition ${tab === id ? "bg-card text-foreground shadow-sm" : "text-subtle"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "comidas" ? <SavedMealsList /> : tab === "dietas" ? <DietsList /> : <WeekPlan />}
    </>
  );
}
