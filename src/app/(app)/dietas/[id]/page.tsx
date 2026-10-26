import { DietView } from "@/components/diet-view";

export default async function DietaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DietView id={id} />;
}
