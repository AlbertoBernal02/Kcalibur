// Contenedor común de las pantallas de acceso (recuperar / restablecer contraseña).
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-primary">{title}</h1>
        <p className="mt-2 text-subtle">{subtitle}</p>
      </header>
      {children}
    </main>
  );
}
