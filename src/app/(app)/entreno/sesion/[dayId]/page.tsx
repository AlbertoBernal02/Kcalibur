import { Workout } from "@/components/training/workout";

// `?semana=N` abre la sesión de esa semana; sin él, la semana actual de la rutina.
export default async function SesionPage({ params, searchParams }: { params: Promise<{ dayId: string }>; searchParams: Promise<{ semana?: string }> }) {
  const { dayId } = await params;
  const { semana } = await searchParams;
  const week = Number.parseInt(semana ?? "", 10);
  return (
    <div data-mode="training">
      <Workout dayId={dayId} initialWeek={Number.isFinite(week) && week >= 1 ? week : null} />
    </div>
  );
}
