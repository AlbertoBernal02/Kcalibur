import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rutas accesibles sin sesión.
const PUBLIC = ["/login", "/registro"];

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
  const isPublic = PUBLIC.includes(request.nextUrl.pathname);

  if (!user && !isPublic) return NextResponse.redirect(new URL("/login", request.url));
  if (user && isPublic) return NextResponse.redirect(new URL("/", request.url));
  return response;
}

export const config = {
  // Excluye estáticos, iconos y los ficheros PWA.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:png|svg|jpg|ico|webp)$).*)",
  ],
};
