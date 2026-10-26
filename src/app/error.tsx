"use client";

import { Button } from "@/components/ui";

// Se muestra si una pantalla lanza un error inesperado.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold">Algo ha fallado</h1>
      <p className="text-subtle">Ha ocurrido un error inesperado. Tus datos están a salvo.</p>
      <Button onClick={reset}>Reintentar</Button>
    </main>
  );
}
