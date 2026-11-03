"use client";

import { useEffect, useState } from "react";
import { fmtClock } from "@/lib/training/log";

// El navegador solo deja sonar audio tras un gesto del usuario: se prepara al marcar una serie.
let audio: AudioContext | null = null;
export function primeAudio() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {
    /* sin audio: solo vibración */
  }
}

function alarm() {
  navigator.vibrate?.([250, 120, 250]);
  if (!audio) return;
  try {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.3);
  } catch {
    /* ignorar */
  }
}

export type Rest = { endsAt: number; total: number };

// Cuenta atrás de descanso fija sobre la barra inferior. Avisa (vibración + pitido) al llegar a 0.
export function RestTimer({ rest, onChange, onClose }: { rest: Rest; onChange: (r: Rest) => void; onClose: () => void }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [rest.endsAt]);

  const left = Math.max(0, Math.ceil((rest.endsAt - now) / 1000));
  const finished = left === 0;

  // Aviso único al terminar y cierre automático unos segundos después.
  useEffect(() => {
    if (!finished) return;
    alarm();
    const id = setTimeout(onClose, 6000);
    return () => clearTimeout(id);
  }, [finished, onClose]);

  return (
    <div role="timer" aria-live="off" className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4rem)] z-30 px-4">
      <div className="mx-auto flex max-w-2xl items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-primary-fg shadow-lg">
        <div className="flex-1">
          <p className="text-xs opacity-80">{finished ? "¡Descanso terminado!" : "Descanso"}</p>
          <p className="text-3xl font-bold tabular-nums">{finished ? "A por la siguiente" : fmtClock(left)}</p>
        </div>
        {!finished && (
          <button onClick={() => onChange({ ...rest, endsAt: rest.endsAt + 15_000 })} className="h-11 rounded-xl bg-primary-fg/15 px-3 font-semibold">
            +15 s
          </button>
        )}
        <button onClick={onClose} className="h-11 rounded-xl bg-primary-fg/15 px-3 font-semibold">
          {finished ? "Cerrar" : "Saltar"}
        </button>
      </div>
    </div>
  );
}
