"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { friendlyAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth-shell";
import { Button, Field, inputCls } from "@/components/ui";

type Phase = "checking" | "ready" | "invalid" | "done";

// Pantalla a la que llega el enlace del email: canjea el código por una sesión y pide la contraseña nueva.
export function ResetForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [reason, setReason] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = createClient();
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const fail = (msg: string) => {
      setReason(msg);
      setPhase("invalid");
    };
    if (params.get("error_description")) return fail(friendlyAuthError(params.get("error_description")!));

    (async () => {
      if (code) {
        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (error) return fail(friendlyAuthError(error.message));
        history.replaceState(null, "", "/restablecer"); // quita el código de la URL
      }
      const { data } = await sb.auth.getSession();
      if (data.session) setPhase("ready");
      else fail("El enlace no es válido o ha caducado. Pide uno nuevo.");
    })().catch(() => fail("No hay conexión con el servidor."));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(friendlyAuthError(error.message));
    setPhase("done");
    setTimeout(() => router.replace("/"), 1500);
  }

  return (
    <AuthShell title="Nueva contraseña" subtitle="Elige una contraseña para tu cuenta">
      {phase === "checking" && <div className="h-24 animate-pulse rounded-2xl bg-muted" aria-label="Comprobando enlace" />}

      {phase === "invalid" && (
        <div className="flex flex-col gap-4 text-center">
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{reason}</p>
          <Link href="/recuperar" className="flex h-14 items-center justify-center rounded-2xl bg-primary font-semibold text-primary-fg">Pedir un enlace nuevo</Link>
          <p className="text-xs text-subtle">Abre el enlace en el mismo navegador desde el que lo pediste.</p>
        </div>
      )}

      {phase === "ready" && (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Contraseña nueva">
            <input type="password" required minLength={6} autoComplete="new-password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={busy || password.length < 6}>{busy ? "Guardando…" : "Guardar contraseña"}</Button>
        </form>
      )}

      {phase === "done" && <p role="status" className="rounded-xl bg-primary/10 px-4 py-3 text-center text-sm text-primary">Contraseña actualizada ✓ Entrando…</p>}
    </AuthShell>
  );
}
