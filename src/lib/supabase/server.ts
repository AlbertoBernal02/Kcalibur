import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente de Supabase para código de servidor (rutas /api): usa la sesión del usuario de las cookies,
// así que RLS se aplica igual que en el navegador. La renovación del token ya la hace proxy.ts.
export async function createServerSupabase() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: () => {
        /* solo lectura: las cookies las gestiona el proxy */
      },
    },
  });
}
