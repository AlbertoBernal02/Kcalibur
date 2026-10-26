import { BottomNav } from "@/components/bottom-nav";

// Layout de la zona autenticada: contenido + navegación inferior con safe areas.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+6rem)]">
      {children}
      <BottomNav />
    </div>
  );
}
