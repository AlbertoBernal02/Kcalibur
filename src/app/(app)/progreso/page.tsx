import { PageHeader } from "@/components/page-header";
import { ProgressView } from "@/components/progress-view";

export default function ProgresoPage() {
  return (
    <>
      <PageHeader title="Progreso" subtitle="Agua, calorías y peso." />
      <ProgressView />
    </>
  );
}
