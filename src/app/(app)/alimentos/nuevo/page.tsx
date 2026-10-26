import { FoodEditor, type Prefill } from "@/components/food-editor";

const KEYS = ["name", "brand", "barcode", "kcal", "protein", "carbs", "fat", "serving"] as const;

// Los parámetros de la URL (producto de Open Food Facts incompleto) precargan el formulario.
export default async function NuevoAlimentoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const prefill: Prefill = {};
  for (const k of KEYS) {
    const v = sp[k];
    if (typeof v === "string") prefill[k] = v.slice(0, 120);
  }
  return <FoodEditor prefill={prefill} />;
}
