"use client";

import { useRouter } from "next/navigation";
import { clearOfflineData } from "@/lib/offline/store";
import { getSyncState } from "@/lib/offline/sync";
import { createClient } from "@/lib/supabase/client";

// Cierra la sesión, borra los datos guardados en el dispositivo y vuelve al login.
export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const { pending } = getSyncState();
    // Los cambios sin sincronizar se perderían al borrar la caché local: avisar antes.
    if (pending > 0 && !confirm(`Hay ${pending} cambios sin sincronizar que se perderán. ¿Cerrar sesión igualmente?`)) return;
    await createClient().auth.signOut();
    await clearOfflineData();
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
