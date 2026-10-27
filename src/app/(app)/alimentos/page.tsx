import { Scale } from "lucide-react";
import Link from "next/link";
import { FoodList } from "@/components/food-list";
import { PageHeader } from "@/components/page-header";

export default function AlimentosPage() {
  return (
    <>
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <PageHeader title="Alimentos" subtitle="Genéricos y los tuyos." />
        </div>
        <Link href="/comparar" className="mt-1 flex h-11 items-center gap-2 rounded-2xl bg-card px-4 text-sm font-semibold text-primary active:scale-95">
          <Scale size={18} /> Comparar
        </Link>
      </div>
      <FoodList />
    </>
  );
}
