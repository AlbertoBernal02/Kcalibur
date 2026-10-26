import { FoodList } from "@/components/food-list";
import { PageHeader } from "@/components/page-header";

export default function AlimentosPage() {
  return (
    <>
      <PageHeader title="Alimentos" subtitle="Genéricos y los tuyos." />
      <FoodList />
    </>
  );
}
