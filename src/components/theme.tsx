"use client";

import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";
const KEY = "kcalibur-theme";

// Aplica la clase `dark` al <html> según el modo elegido.
function apply(mode: Mode) {
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

// Script inline (se ejecuta antes de pintar) para evitar parpadeo al cargar.
export const themeInitScript = `try{var m=localStorage.getItem("${KEY}")||"system";if(m==="dark"||(m==="system"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

const LABELS: Record<Mode, string> = { system: "Sistema", light: "Claro", dark: "Oscuro" };

// Selector de tema de 3 opciones (sistema / claro / oscuro).
export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    // Lee la preferencia guardada tras hidratar (localStorage no existe en servidor).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode((localStorage.getItem(KEY) as Mode) || "system");
  }, []);

  function choose(m: Mode) {
    setMode(m);
    localStorage.setItem(KEY, m);
    apply(m);
  }

  return (
    <div className="flex rounded-2xl bg-muted p-1" role="radiogroup" aria-label="Tema">
      {(Object.keys(LABELS) as Mode[]).map((m) => (
        <button
          key={m}
          role="radio"
          aria-checked={mode === m}
          onClick={() => choose(m)}
          className={`flex-1 rounded-xl py-3 text-sm font-medium transition ${
            mode === m ? "bg-card text-foreground shadow-sm" : "text-subtle"
          }`}
        >
          {LABELS[m]}
        </button>
      ))}
    </div>
  );
}
