"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Cierra la sesión y vuelve al login.
export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className="h-14 w-full rounded-2xl border border-border bg-card font-semibold text-danger transition active:scale-[0.98]"
    >
      Cerrar sesión
    </button>
  );
}
