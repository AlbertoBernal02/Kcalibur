import { NextResponse, type NextRequest } from "next/server";
import { toOffProduct, type OffProduct } from "@/lib/off";

// Search-a-licious (el buscador de texto actual de Open Food Facts). No expone CORS al
// navegador, así que se consulta desde el servidor, donde además podemos fijar User-Agent.
const URL_SEARCH = "https://search.openfoodfacts.org/search";
const UA = "Kcalibur/1.0 (personal nutrition tracker PWA)";
const FIELDS = "code,product_name,product_name_es,brands,nutriments,serving_quantity";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 100) return NextResponse.json({ error: "Consulta no válida" }, { status: 400 });

  try {
    const params = new URLSearchParams({ q, page_size: "24", fields: FIELDS, langs: "es" });
    const res = await fetch(`${URL_SEARCH}?${params}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`OFF ${res.status}`);
    const data = (await res.json()) as { hits?: Record<string, unknown>[] };
    const products = (data.hits ?? []).map(toOffProduct).filter((p): p is OffProduct => p !== null);
    return NextResponse.json({ products });
  } catch {
    return NextResponse.json({ error: "Open Food Facts no responde" }, { status: 502 });
  }
}
