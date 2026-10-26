import { SavedMealEditor } from "@/components/saved-meal-editor";

export default async function OpcionPage({ params }: { params: Promise<{ id: string; optionId: string }> }) {
  const { id, optionId } = await params;
  return <SavedMealEditor id={optionId} dietId={id} />;
}
