// Cabecera estándar de cada pantalla.
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-subtle">{subtitle}</p>}
    </header>
  );
}
