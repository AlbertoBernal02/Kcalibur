import { PageHeader } from "@/components/page-header";
import { ProgramView } from "@/components/training/program-view";

export default function RutinaPage() {
  return (
    <div data-mode="training">
      <PageHeader title="Rutina" subtitle="Días, ejercicios y objetivos." />
      <ProgramView />
    </div>
  );
}
