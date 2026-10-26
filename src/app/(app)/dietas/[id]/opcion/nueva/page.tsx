import { SavedMealEditor } from "@/components/saved-meal-editor";
import { MEALS } from "@/lib/meals";

// ?meal=breakfast|lunch|snack|dinner|extras indica a qué comida de la dieta pertenece la opción.
export default async function NuevaOpcionPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ meal?: string }> }) {
  const [{ id }, { meal }] = await Promise.all([params, searchParams]);
  const slot = MEALS.find((m) => m.id === meal)?.id ?? "breakfast";
  return <SavedMealEditor dietId={id} dietMeal={slot} />;
}
