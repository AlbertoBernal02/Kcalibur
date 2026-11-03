import { PageHeader } from "@/components/page-header";
import { TrainingToday } from "@/components/training/training-today";

export default function EntrenoPage() {
  return (
    <div data-mode="training">
      <PageHeader title="Entreno" subtitle="Tu rutina, semana a semana." />
      <TrainingToday />
    </div>
  );
}
