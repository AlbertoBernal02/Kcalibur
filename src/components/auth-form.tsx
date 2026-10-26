"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { friendlyAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";

// Formulario compartido de login / registro.
export function AuthForm({ mode }: { mode: "login" | "registro" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isLogin = mode === "login";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error } = isLogin
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) return setError(friendlyAuthError(error.message));
    // Sin sesión tras registrarse = el proyecto exige confirmar el email.
    if (!data.session) return setInfo("Revisa tu correo para confirmar la cuenta.");
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-primary">Kcalibur</h1>
        <p className="mt-2 text-subtle">{isLogin ? "Bienvenido de nuevo" : "Crea tu cuenta"}</p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-14 rounded-2xl border border-border bg-card px-4 outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Contraseña
          <input
            type="password"
            required
            minLength={6}
            autoComplete={isLogin ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-14 rounded-2xl border border-border bg-card px-4 outline-none focus:border-primary"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        {info && <p className="rounded-xl bg-primary/10 px-4 py-3 text-sm text-primary">{info}</p>}

        <button
          type="submit"
          disabled={loading}
          className="h-14 rounded-2xl bg-primary text-base font-semibold text-primary-fg transition active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? "Un momento…" : isLogin ? "Entrar" : "Crear cuenta"}
        </button>
        {isLogin && (
          <Link href="/recuperar" className="flex h-11 items-center justify-center text-sm font-medium text-subtle">
            ¿Olvidaste tu contraseña?
          </Link>
        )}
      </form>

      <p className="text-center text-sm text-subtle">
        {isLogin ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
        <Link href={isLogin ? "/registro" : "/login"} className="font-semibold text-primary">
          {isLogin ? "Regístrate" : "Inicia sesión"}
        </Link>
      </p>
    </main>
  );
}
