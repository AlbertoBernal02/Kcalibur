"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { exportBody, exportDiary, exportFoods, type ExportResult } from "@/lib/data/export";
import { toISO } from "@/lib/meals";
import { createClient } from "@/lib/supabase/client";

const EXPORTS: { id: string; label: string; file: string; run: (sb: ReturnType<typeof createClient>) => Promise<ExportResult> }[] = [
  { id: "diary", label: "Diario de comidas", file: "kcalibur-diario", run: exportDiary },
  { id: "body", label: "Peso y agua", file: "kcalibur-peso-agua", run: exportBody },
  { id: "foods", label: "Mis alimentos", file: "kcalibur-alimentos", run: exportFoods },
];

// Guarda el CSV: en iPhone/iPad con el menú de compartir (para dejarlo en Archivos); en el resto, descarga directa.
async function saveCsv(filename: string, csv: string) {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }); // BOM: Excel reconoce los acentos
  const file = new File([blob], filename, { type: "text/csv" });
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // el usuario cerró el menú
    }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Botones de exportación a CSV (separador ";" y coma decimal: se abre directo en Excel en español).
export function ExportSection() {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(e: (typeof EXPORTS)[number]) {
    setBusy(e.id);
    setMsg(null);
    try {
      const { csv, rows } = await e.run(createClient());
      if (rows === 0) return setMsg({ ok: false, text: `No hay datos en «${e.label}» para exportar.` });
      await saveCsv(`${e.file}-${toISO(new Date())}.csv`, csv);
      setMsg({ ok: true, text: `«${e.label}» exportado (${rows} ${rows === 1 ? "fila" : "filas"}).` });
    } catch {
      setMsg({ ok: false, text: "No se pudo exportar. Comprueba la conexión e inténtalo de nuevo." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {EXPORTS.map((e) => (
        <button
          key={e.id}
          onClick={() => run(e)}
          disabled={busy !== null}
          className="flex h-14 items-center gap-3 rounded-2xl border border-border bg-card px-4 text-left font-medium transition active:scale-[0.98] disabled:opacity-60"
        >
          <Download size={20} className="text-primary" />
          <span className="flex-1">{e.label}</span>
          <span className="text-sm text-subtle">{busy === e.id ? "Preparando…" : "CSV"}</span>
        </button>
      ))}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
