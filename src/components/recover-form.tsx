"use client";

import Link from "next/link";
import { useState } from "react";
import { friendlyAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth-shell";
import { Button, Field, inputCls } from "@/components/ui";

// Pide un enlace para restablecer la contraseña.
export function RecoverForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/restablecer` });
    setBusy(false);
    // Respuesta idéntica exista o no la cuenta (no revela qué emails están registrados).
    if (error && !/user not found/i.test(error.message)) return setError(friendlyAuthError(error.message));
    setSent(true);
  }

  return (
    <AuthShell title="Recuperar acceso" subtitle="Te enviaremos un enlace por email">
      {sent ? (
        <div className="flex flex-col gap-4 text-center">
          <p role="status" className="rounded-xl bg-primary/10 px-4 py-3 text-sm text-primary">
            Si existe una cuenta con ese email, te hemos enviado un enlace para elegir una contraseña nueva.
          </p>
          <p className="text-sm text-subtle">Ábrelo en este mismo navegador. Si no llega, revisa la carpeta de spam.</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Email">
            <input type="email" required autoComplete="email" inputMode="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={busy || !email.trim()}>{busy ? "Enviando…" : "Enviar enlace"}</Button>
        </form>
      )}
      <Link href="/login" className="text-center text-sm font-semibold text-primary">Volver a iniciar sesión</Link>
    </AuthShell>
  );
}
