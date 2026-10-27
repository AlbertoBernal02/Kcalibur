"use client";

import { AOVE_PUFFS } from "@/lib/serving";

// Casilla para añadir el AOVE en spray junto a un alimento que se cocina en sartén (carne o pescado).
export function AoveToggle({ checked, onChange }: { checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="mb-3 flex items-center gap-3 rounded-2xl bg-card px-4 py-3 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 shrink-0 accent-primary" />
      <span>
        Añadir {AOVE_PUFFS} puffs de AOVE <span className="text-subtle">(para la sartén, ≈ 22 kcal)</span>
      </span>
    </label>
  );
}
