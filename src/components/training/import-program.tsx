"use client";

import { FileSpreadsheet } from "lucide-react";
import { useRef, useState } from "react";
import { importProgram } from "@/lib/data/training";
import { createClient, currentUserId } from "@/lib/supabase/client";
import type { ParsedProgram } from "@/lib/training/types";
import { Button, inputCls } from "@/components/ui";
import { ErrorNote } from "./bits";

type Preview = { name: string; program: ParsedProgram };

// Importar una rutina desde un Excel: subir → vista previa (se puede renombrar) → crear.
// `onImported` recarga la rutina del padre al terminar.
export function ImportProgram({ replacing = false, onImported }: { replacing?: boolean; onImported: () => Promise<void> | void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/training/import", { method: "POST", body });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.program) throw new Error(data?.error ?? "No se pudo leer el archivo.");
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = ""; // permite volver a elegir el mismo archivo
    }
  }

  async function create() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      await importProgram(createClient(), await currentUserId(), preview.name.trim() || "Mi rutina", preview.program);
      setPreview(null);
      await onImported();
    } catch {
      setError("No se pudo guardar la rutina. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const stats = preview && {
    days: preview.program.days.length,
    exercises: preview.program.days.reduce((n, d) => n + d.exercises.length, 0),
    logged: preview.program.days.reduce((n, d) => n + d.exercises.reduce((m, e) => m + e.history.length, 0), 0),
  };

  return (
    <div>
      <input ref={fileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden aria-label="Archivo Excel de la rutina" onChange={(e) => onFile(e.target.files?.[0])} />
      {error && <ErrorNote>{error}</ErrorNote>}

      {!preview ? (
        <>
          <Button variant={replacing ? "secondary" : "primary"} disabled={busy} onClick={() => fileRef.current?.click()} className="flex items-center justify-center gap-2">
            <FileSpreadsheet size={20} />
            {busy ? "Leyendo el Excel…" : replacing ? "Importar otra rutina (Excel)" : "Importar mi Excel"}
          </Button>
          <p className="mt-2 text-xs text-subtle">
            Un .xlsx con una hoja por día. En Google Sheets: Archivo → Descargar → Microsoft Excel (.xlsx).
            {replacing && " La rutina actual se archiva y la nueva pasa a ser la activa."}
          </p>
        </>
      ) : (
        <div className="rounded-3xl bg-card p-5">
          <h3 className="font-semibold">Esto es lo que he encontrado</h3>
          <p className="mt-1 text-sm text-subtle">
            {stats!.days} días · {stats!.exercises} ejercicios · {preview.program.weeks} semanas · {stats!.logged} series ya registradas en tu Excel
          </p>
          <label className="mt-4 flex flex-col gap-1.5 text-sm font-medium">
            Nombre de la rutina
            <input className={inputCls} value={preview.name} onChange={(e) => setPreview({ ...preview, name: e.target.value })} maxLength={120} />
          </label>
          <ul className="mt-4 flex flex-col gap-3">
            {preview.program.days.map((d) => (
              <li key={d.name} className="text-sm">
                <p className="font-medium">{d.name}</p>
                <p className="text-subtle">{d.exercises.map((e) => e.name).join(" · ")}</p>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-col gap-2">
            <Button disabled={busy} onClick={create}>{busy ? "Creando…" : "Crear mi rutina"}</Button>
            <Button variant="secondary" disabled={busy} onClick={() => setPreview(null)}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
