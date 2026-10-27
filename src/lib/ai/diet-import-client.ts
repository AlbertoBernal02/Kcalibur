import type { DietImport } from "@/lib/ai/diet-import";

// Pide al servidor que estructure el texto de un plan nutricional. Lanza Error con un mensaje listo para mostrar.
export async function requestDietImport(text: string): Promise<DietImport> {
  let res: Response;
  try {
    res = await fetch("/api/ai/diet-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    throw new Error("Sin conexión: importar con IA necesita internet.");
  }
  const data = (await res.json().catch(() => null)) as (DietImport & { error?: string }) | null;
  if (!res.ok || !data || data.error) throw new Error(data?.error ?? "No se pudo analizar el plan. Inténtalo de nuevo.");
  return data;
}
