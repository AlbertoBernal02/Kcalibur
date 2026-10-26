import { AccountSection } from "@/components/account-section";
import { ExportSection } from "@/components/export-section";
import { PageHeader } from "@/components/page-header";
import { ProfileForm } from "@/components/profile-form";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme";
import { Section } from "@/components/ui";

export default function PerfilPage() {
  return (
    <>
      <PageHeader title="Perfil" subtitle="Tus datos, objetivos y ajustes." />
      <ProfileForm />
      <div className="mt-8">
        <Section title="Apariencia">
          <ThemeToggle />
        </Section>
        <Section title="Exportar mis datos">
          <ExportSection />
        </Section>
        <Section title="Cuenta">
          <AccountSection />
        </Section>
        <SignOutButton />
      </div>
    </>
  );
}
