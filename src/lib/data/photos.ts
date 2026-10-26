import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "progress-photos";
const URL_TTL = 60 * 60; // las URLs firmadas caducan a la hora (el bucket es privado)

export type Photo = { id: string; taken_on: string; path: string; note: string | null; url: string };

// Fotos del usuario (de la más reciente a la más antigua) con una URL firmada para mostrarlas.
export async function listPhotos(sb: SupabaseClient): Promise<Photo[]> {
  const { data, error } = await sb
    .from("progress_photos")
    .select("id, taken_on, path, note")
    .order("taken_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (data.length === 0) return [];
  const signed = await sb.storage.from(BUCKET).createSignedUrls(
    data.map((r) => r.path as string),
    URL_TTL,
  );
  if (signed.error) throw signed.error;
  const urls = new Map(signed.data.map((s) => [s.path, s.signedUrl]));
  return data.map((r) => ({ ...(r as Omit<Photo, "url">), url: urls.get(r.path as string) ?? "" }));
}

// Sube la imagen a la carpeta del usuario y registra la foto. Si falla el registro se borra el fichero.
export async function uploadPhoto(sb: SupabaseClient, userId: string, blob: Blob, takenOn: string, note: string | null) {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
  if (up.error) throw up.error;
  const ins = await sb.from("progress_photos").insert({ user_id: userId, taken_on: takenOn, path, note });
  if (ins.error) {
    await sb.storage.from(BUCKET).remove([path]);
    throw ins.error;
  }
}

// Borra primero la fila (si falla, la foto sigue visible y consistente) y luego el fichero.
export async function deletePhoto(sb: SupabaseClient, photo: Photo) {
  const del = await sb.from("progress_photos").delete().eq("id", photo.id);
  if (del.error) throw del.error;
  await sb.storage.from(BUCKET).remove([photo.path]); // si falla queda un fichero huérfano inaccesible, sin impacto visible
}
