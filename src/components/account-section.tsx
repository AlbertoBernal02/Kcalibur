"use client";

import { useEffect, useState } from "react";
import { friendlyAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, inputCls } from "@/components/ui";

// Cuenta: email actual y cambio de contraseña.
export function AccountSection() {
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return setMsg({ ok: false, text: "La contraseña debe tener al menos 6 caracteres." });
    if (password !== confirm) return setMsg({ ok: false, text: "Las contraseñas no coinciden." });
    setBusy(true);
    setMsg(null);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: friendlyAuthError(error.message) });
    setPassword("");
    setConfirm("");
    setMsg({ ok: true, text: "Contraseña actualizada ✓" });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-2xl bg-card px-4 py-3 text-sm">
        <span className="text-subtle">Sesión iniciada como </span>
        <span className="font-semibold">{email ?? "…"}</span>
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Field label="Contraseña nueva">
          <input type="password" autoComplete="new-password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Repite la contraseña">
          <input type="password" autoComplete="new-password" className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"}`}>{msg.text}</p>
        )}
        <Button type="submit" variant="secondary" disabled={busy || !password}>{busy ? "Guardando…" : "Cambiar contraseña"}</Button>
      </form>
    </div>
  );
}
