import { parseGrids } from "@/lib/training/import-grid";
import { readWorkbook } from "@/lib/training/xlsx-read";
import { createServerSupabase } from "@/lib/supabase/server";

const MAX_BYTES = 5 * 1024 * 1024;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

// Lee un .xlsx de rutina y devuelve la rutina estructurada para la vista previa (no guarda nada).
export async function POST(request: Request) {
  const sb = await createServerSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return json({ error: "No has iniciado sesión." }, 401);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return json({ error: "Falta el archivo." }, 400);
  if (!/\.xlsx$/i.test(file.name)) return json({ error: "Sube un archivo .xlsx (en Google Sheets: Archivo → Descargar → Microsoft Excel)." }, 400);
  if (file.size > MAX_BYTES) return json({ error: "El archivo es demasiado grande (máximo 5 MB)." }, 413);

  try {
    const program = parseGrids(await readWorkbook(Buffer.from(await file.arrayBuffer())));
    if (!program) return json({ error: "No he reconocido la estructura: cada hoja debería ser un día, con la cabecera EJERCICIO y columnas SEMANA 1, SEMANA 2…" }, 422);
    return json({ name: file.name.replace(/\.xlsx$/i, ""), program });
  } catch (e) {
    console.warn("Importación de rutina fallida:", e);
    return json({ error: "No he podido leer el archivo. ¿Está dañado o protegido con contraseña?" }, 422);
  }
}
