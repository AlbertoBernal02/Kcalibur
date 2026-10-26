"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DecodeHintType } from "@zxing/library"; // solo el tipo: la librería se carga bajo demanda
import { Button, inputCls } from "@/components/ui";

// BarcodeDetector no está en lib.dom: tipado mínimo de lo que usamos.
type NativeDetector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => NativeDetector;
  }
}

const CODE_RE = /^\d{8,14}$/;
const NATIVE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

// Mensaje claro según el motivo por el que falla la cámara.
function cameraError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError") return "Permiso de cámara denegado. Actívalo en los ajustes del navegador o escribe el código a mano.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No se encontró ninguna cámara. Escribe el código a mano.";
  if (name === "NotReadableError") return "La cámara está en uso por otra aplicación.";
  return "No se pudo iniciar la cámara. Escribe el código a mano.";
}

// Escáner a pantalla completa: cámara trasera + lectura (nativa o ZXing) + entrada manual.
export function BarcodeScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let cancelled = false;
    let handled = false;
    let stream: MediaStream | null = null;
    let stopReader: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Acepta solo códigos EAN/UPC numéricos y avisa una única vez.
    function finish(text: string) {
      if (handled || !CODE_RE.test(text)) return;
      handled = true;
      navigator.vibrate?.(60);
      onCodeRef.current(text);
    }

    async function start() {
      const video = videoRef.current;
      if (!video) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        return setError("La cámara solo funciona con HTTPS. Escribe el código a mano.");
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) return;
        setStatus("scanning");

        if (window.BarcodeDetector) {
          // Android/Chrome: detector nativo, sin cargar librerías.
          video.srcObject = stream;
          await video.play();
          const detector = new window.BarcodeDetector({ formats: NATIVE_FORMATS });
          const tick = async () => {
            if (cancelled || handled) return;
            try {
              const found = await detector.detect(video);
              if (found[0]) finish(found[0].rawValue);
            } catch {
              // un fotograma fallido no es grave: se reintenta
            }
            timer = setTimeout(tick, 200);
          };
          tick();
        } else {
          // iPhone/Safari y resto: ZXing (se carga solo ahora).
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const { BarcodeFormat, DecodeHintType: Hint } = await import("@zxing/library");
          if (cancelled) return;
          // Sin TRY_HARDER: este modo rota la imagen para leer códigos verticales y genera
          // errores de canvas continuos; con el móvil en vertical y el código horizontal no hace falta.
          const hints = new Map<DecodeHintType, unknown>([
            [Hint.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
          ]);
          const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
          const controls = await reader.decodeFromStream(stream, video, (result) => result && finish(result.getText()));
          stopReader = () => controls.stop();
          if (cancelled) controls.stop();
        }
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setError(cameraError(e));
      }
    }
    start();

    // Al cerrar: parar lectura, temporizador y todas las pistas de la cámara.
    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopReader?.();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const code = manual.trim();
    if (!CODE_RE.test(code)) return setError("El código debe tener entre 8 y 14 dígitos.");
    onCode(code);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Escáner de código de barras" className="fixed inset-0 z-[60] flex flex-col bg-black text-white">
      <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />

      <header className="relative flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4 pb-6 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <h2 className="text-lg font-bold">Escanear código</h2>
        <button onClick={onClose} aria-label="Cerrar escáner" className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50">
          <X size={24} />
        </button>
      </header>

      {/* Marco guía */}
      <div className="pointer-events-none relative flex flex-1 items-center justify-center">
        {status !== "error" && <div className="h-40 w-[80%] max-w-sm rounded-2xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />}
        {status === "starting" && <p className="absolute text-sm">Iniciando cámara…</p>}
        {status === "scanning" && <p className="absolute bottom-6 rounded-full bg-black/60 px-4 py-1.5 text-sm">Apunta al código de barras</p>}
      </div>

      <form onSubmit={submitManual} className="relative flex flex-col gap-3 rounded-t-3xl bg-background p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] text-foreground">
        {error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          O escribe el código a mano
          <input
            className={inputCls}
            inputMode="numeric"
            placeholder="8480000105424"
            value={manual}
            onChange={(e) => setManual(e.target.value.replace(/\D/g, ""))}
          />
        </label>
        <Button type="submit" disabled={manual.length < 8}>Buscar código</Button>
      </form>
    </div>
  );
}
