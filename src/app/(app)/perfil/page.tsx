import { PageHeader } from "@/components/page-header";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme";

export default function PerfilPage() {
  return (
    <>
      <PageHeader title="Perfil" subtitle="Tu cuenta y ajustes." />
      <section className="mb-6 flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-subtle">Apariencia</h2>
        <ThemeToggle />
      </section>
      <SignOutButton />
    </>
  );
}
