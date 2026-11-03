"use client";

import { BookOpen, Apple, ChefHat, ClipboardList, Dumbbell, LineChart, TrendingUp, User, Utensils, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string; Icon: LucideIcon; match?: (path: string) => boolean };

// Modo Dieta.
const FOOD_TABS: Tab[] = [
  { href: "/", label: "Diario", Icon: BookOpen },
  { href: "/alimentos", label: "Alimentos", Icon: Apple },
  { href: "/comidas", label: "Comidas", Icon: ChefHat },
  { href: "/progreso", label: "Progreso", Icon: LineChart },
  { href: "/entreno", label: "Entreno", Icon: Dumbbell },
  { href: "/perfil", label: "Perfil", Icon: User },
];

// Modo Entreno: su propia barra; "Dieta" vuelve al otro modo.
const TRAIN_TABS: Tab[] = [
  { href: "/entreno", label: "Hoy", Icon: Dumbbell, match: (p) => p === "/entreno" || p.startsWith("/entreno/sesion") },
  { href: "/entreno/rutina", label: "Rutina", Icon: ClipboardList },
  { href: "/entreno/progreso", label: "Progreso", Icon: TrendingUp },
  { href: "/", label: "Dieta", Icon: Utensils },
];

// Navegación inferior fija; respeta el home indicator de iOS (safe area). Cambia de pestañas según el modo.
export function BottomNav() {
  const pathname = usePathname();
  const training = pathname.startsWith("/entreno");
  const tabs = training ? TRAIN_TABS : FOOD_TABS;
  const isActive = (t: Tab) => (t.match ? t.match(pathname) : t.href === "/" ? pathname === "/" : pathname.startsWith(t.href));

  return (
    <nav
      aria-label={training ? "Entreno" : "Principal"}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-2xl">
        {tabs.map((t) => (
          <li key={t.href} className="flex-1">
            <Link
              href={t.href}
              aria-current={isActive(t) ? "page" : undefined}
              className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition active:scale-95 ${
                isActive(t) ? "text-primary" : "text-subtle"
              }`}
            >
              <t.Icon size={24} strokeWidth={isActive(t) ? 2.4 : 1.8} />
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
