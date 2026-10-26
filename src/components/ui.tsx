// Piezas de UI compartidas (formularios con objetivos táctiles grandes).

export const inputCls =
  "h-14 w-full rounded-2xl border border-border bg-card px-4 outline-none transition focus:border-primary";

// Etiqueta + control.
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

// Tarjeta con título de sección.
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-subtle">{title}</h2>
      {children}
    </section>
  );
}

// Botón principal / secundario de ancho completo.
export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  const styles =
    variant === "primary"
      ? "bg-primary text-primary-fg"
      : "border border-border bg-card text-foreground";
  return (
    <button
      {...props}
      className={`h-14 w-full rounded-2xl font-semibold transition active:scale-[0.98] disabled:opacity-60 ${styles} ${className}`}
    />
  );
}
