import type { Estimate } from "@/lib/ai/estimate";

// Pide al servidor la estimación de una comida de fuera. Lanza Error con un mensaje listo para mostrar.
export async function requestEstimate(text: string): Promise<Estimate> {
  let res: Response;
  try {
    res = await fetch("/api/ai/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    throw new Error("Sin conexión: la estimación con IA necesita internet.");
  }
  const data = (await res.json().catch(() => null)) as (Estimate & { error?: string }) | null;
  if (!res.ok || !data || data.error) throw new Error(data?.error ?? "No se pudo estimar. Inténtalo de nuevo.");
  return data;
}
