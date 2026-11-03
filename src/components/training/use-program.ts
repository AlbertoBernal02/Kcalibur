"use client";

import { useCallback, useEffect, useState } from "react";
import { loadProgram, type ProgramData } from "@/lib/data/training";
import { createClient } from "@/lib/supabase/client";

// Carga el programa activo. `program`: undefined = cargando, null = aún no hay rutina.
export function useProgram() {
  const [program, setProgram] = useState<ProgramData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setProgram(await loadProgram(createClient()));
      setError(null);
    } catch {
      setError("No se pudo cargar tu rutina.");
    }
  }, []);

  useEffect(() => {
    let stale = false;
    loadProgram(createClient())
      .then((p) => !stale && setProgram(p))
      .catch(() => !stale && setError("No se pudo cargar tu rutina."));
    return () => {
      stale = true;
    };
  }, []);

  return { program, setProgram, error, reload };
}
