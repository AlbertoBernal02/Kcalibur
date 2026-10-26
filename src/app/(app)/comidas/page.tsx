import { PageHeader } from "@/components/page-header";
import { SavedMealsList } from "@/components/saved-meals-list";

export default function ComidasPage() {
  return (
    <>
      <PageHeader title="Comidas" subtitle="Comidas guardadas y recetas." />
      <SavedMealsList />
    </>
  );
}
