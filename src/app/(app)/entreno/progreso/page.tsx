import { PageHeader } from "@/components/page-header";
import { TrainingProgress } from "@/components/training/training-progress";

export default function ProgresoEntrenoPage() {
  return (
    <div data-mode="training">
      <PageHeader title="Progreso" subtitle="Cómo evolucionan tus levantamientos." />
      <TrainingProgress />
    </div>
  );
}
