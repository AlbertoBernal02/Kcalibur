"use client";

import { BookOpen, Apple, ChefHat, LineChart, User, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/", label: "Diario", Icon: BookOpen },
  { href: "/alimentos", label: "Alimentos", Icon: Apple },
  { href: "/comidas", label: "Comidas", Icon: ChefHat },
  { href: "/progreso", label: "Progreso", Icon: LineChart },
  { href: "/perfil", label: "Perfil", Icon: User },
];

// Navegación inferior fija; respeta el home indicator de iOS (safe area).
export function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map(({ href, label, Icon }) => (
          <li key={href} className="flex-1">
            <Link
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition active:scale-95 ${
                isActive(href) ? "text-primary" : "text-subtle"
              }`}
            >
              <Icon size={24} strokeWidth={isActive(href) ? 2.4 : 1.8} />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
