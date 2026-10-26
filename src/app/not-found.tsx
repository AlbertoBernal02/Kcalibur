import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold">Página no encontrada</h1>
      <p className="text-subtle">Esta dirección no existe.</p>
      <Link href="/" className="flex h-14 w-full items-center justify-center rounded-2xl bg-primary font-semibold text-primary-fg">
        Ir al diario
      </Link>
    </main>
  );
}
