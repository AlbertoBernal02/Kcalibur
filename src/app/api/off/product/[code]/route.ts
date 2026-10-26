import { NextResponse } from "next/server";
import { toOffProduct } from "@/lib/off";

const URL_PRODUCT = "https://world.openfoodfacts.org/api/v2/product";
const UA = "Kcalibur/1.0 (personal nutrition tracker PWA)";
const FIELDS = "code,product_name,product_name_es,brands,nutriments,serving_quantity";

// Producto por código de barras. `product: null` = no existe en Open Food Facts.
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^\d{6,14}$/.test(code)) return NextResponse.json({ error: "Código no válido" }, { status: 400 });

  try {
    const res = await fetch(`${URL_PRODUCT}/${code}.json?fields=${FIELDS}`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    // OFF responde 404 con status 0 cuando el código no existe.
    if (res.status === 404) return NextResponse.json({ product: null });
    if (!res.ok) throw new Error(`OFF ${res.status}`);
    const data = (await res.json()) as { status?: number; product?: Record<string, unknown> };
    return NextResponse.json({ product: data.status === 0 || !data.product ? null : toOffProduct({ ...data.product, code }) });
  } catch {
    return NextResponse.json({ error: "Open Food Facts no responde" }, { status: 502 });
  }
}
