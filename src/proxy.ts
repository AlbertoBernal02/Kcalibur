import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Pantallas de acceso: solo sin sesión (con sesión se redirige al diario).
const AUTH_ONLY = ["/login", "/registro", "/recuperar"];
// Accesible con y sin sesión: el enlace del email crea la sesión en esta propia pantalla.
const OPEN = ["/restablecer"];

// Refresca la sesión de Supabase y redirige según esté o no autenticado.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookies) {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isAuthPage = AUTH_ONLY.includes(path);

  if (!user && !isAuthPage && !OPEN.includes(path)) return NextResponse.redirect(new URL("/login", request.url));
  if (user && isAuthPage) return NextResponse.redirect(new URL("/", request.url));
  return response;
}

export const config = {
  // Excluye estáticos, iconos y los ficheros PWA.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:png|svg|jpg|ico|webp)$).*)",
  ],
};
