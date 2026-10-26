import { FoodEditor } from "@/components/food-editor";

export default async function AlimentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FoodEditor id={id} />;
}
