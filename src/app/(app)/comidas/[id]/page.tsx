import { SavedMealEditor } from "@/components/saved-meal-editor";

export default async function ComidaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SavedMealEditor id={id} />;
}
