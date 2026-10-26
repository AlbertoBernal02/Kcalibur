import { createBrowserClient } from "@supabase/ssr";

// Cliente de Supabase para componentes cliente (la sesión vive en cookies).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// Id del usuario leído de la sesión local (sin llamada de red, válido offline).
export async function currentUserId(): Promise<string> {
  const { data } = await createClient().auth.getSession();
  if (!data.session) throw new Error("sin sesión");
  return data.session.user.id;
}
