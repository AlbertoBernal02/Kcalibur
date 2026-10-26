import { ComidasView } from "@/components/comidas-view";
import { PageHeader } from "@/components/page-header";

// `?tab=dietas` abre directamente la pestaña de dietas (al volver desde una dieta).
export default async function ComidasPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return (
    <>
      <PageHeader title="Comidas" subtitle="Comidas guardadas, recetas y dietas." />
      <ComidasView initialTab={tab === "dietas" ? "dietas" : "comidas"} />
    </>
  );
}
