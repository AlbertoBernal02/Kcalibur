"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { foodLabel, type Food } from "@/lib/data/foods";
import { FoodPicker } from "@/components/food-picker";
import { Sheet } from "@/components/sheet";

// Botón que muestra el alimento elegido y abre el buscador (incluye búsqueda en Open Food Facts y escáner).
export function FoodSelect({ label, food, onChange }: { label: string; food: Food | null; onChange: (f: Food) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left transition active:scale-[0.99]"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-subtle">{label}</span>
          <span className={`block truncate font-medium ${food ? "" : "text-subtle"}`}>{food ? foodLabel(food) : "Elegir alimento…"}</span>
        </span>
        <ChevronDown size={20} className="shrink-0 text-subtle" />
      </button>
      {open && (
        <Sheet title={label} onClose={() => setOpen(false)}>
          <FoodPicker
            onPick={(f) => {
              onChange(f);
              setOpen(false);
            }}
          />
        </Sheet>
      )}
    </>
  );
}
