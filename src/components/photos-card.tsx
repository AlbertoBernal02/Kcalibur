"use client";

import { Camera } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resizeImage } from "@/lib/image";
import { deletePhoto, listPhotos, uploadPhoto, type Photo } from "@/lib/data/photos";
import { loadWeights, type WeightPoint } from "@/lib/data/tracking";
import { addDays, longDate } from "@/lib/meals";
import { daysBetween, groupByDate, nearestWeight, nextPhotoInfo, PHOTO_VIEWS, type PhotoView } from "@/lib/photos";
import { createClient, currentUserId } from "@/lib/supabase/client";
import { Sheet } from "@/components/sheet";
import { Button, Field, inputCls } from "@/components/ui";

const nf = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${nf(Math.abs(n))}`;

// Fotos de progreso: recordatorio quincenal, galería, comparador antes/después y evolución.
export function PhotosCard({ today }: { today: string }) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [weights, setWeights] = useState<WeightPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<Photo | null>(null);

  // Fotos + pesos desde unos días antes de la más antigua (para asociar a cada foto su peso).
  const fetchAll = useCallback(async () => {
    const sb = createClient();
    const list = await listPhotos(sb);
    const w = list.length ? await loadWeights(sb, addDays(list[list.length - 1].taken_on, -3)) : [];
    return { list, w };
  }, []);

  // Refresco tras guardar o borrar una foto.
  const reload = useCallback(async () => {
    const { list, w } = await fetchAll();
    setPhotos(list);
    setWeights(w);
  }, [fetchAll]);

  // Carga inicial; `stale` descarta la respuesta si el componente se desmonta antes.
  useEffect(() => {
    let stale = false;
    fetchAll()
      .then(({ list, w }) => {
        if (stale) return;
        setPhotos(list);
        setWeights(w);
      })
      .catch(() => !stale && setError("No se pudieron cargar las fotos."));
    return () => {
      stale = true;
    };
  }, [fetchAll]);

  const weightOn = (date: string) => nearestWeight(weights, date);
  const next = nextPhotoInfo(photos?.[0]?.taken_on ?? null, today);

  return (
    <section aria-label="Fotos de progreso" className="mb-5 rounded-3xl bg-card p-5">
      <h2 className="font-semibold">Fotos de progreso</h2>
      <p className={`mt-1 text-sm ${next.due ? "font-medium text-primary" : "text-subtle"}`}>
        {!photos
          ? " "
          : photos.length === 0
            ? "Haz tu primera foto para empezar a comparar tu evolución."
            : next.due
              ? `Toca foto quincenal: hace ${next.days} días de la última.`
              : `Próxima foto quincenal en ${next.days} días.`}
      </p>

      <Button type="button" onClick={() => setAdding(true)} className="mt-3 flex items-center justify-center gap-2">
        <Camera size={20} /> Añadir fotos
      </Button>

      {error && <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      {photos && photos.length > 0 && (
        <>
          <div className="mt-4 flex flex-col gap-4">
            {groupByDate(photos).map((g) => (
              <div key={g.date}>
                <p className="mb-1 text-sm font-medium">{longDate(g.date)}</p>
                <ul className="grid grid-cols-3 gap-2">
                  {PHOTO_VIEWS.map((v) => {
                    const p = g.items.find((i) => i.view === v.id);
                    return (
                      <li key={v.id}>
                        {p ? (
                          <button onClick={() => setViewing(p)} aria-label={`Ver ${v.label.toLowerCase()} del ${longDate(g.date)}`} className="relative block w-full overflow-hidden rounded-2xl bg-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal: next/image no aporta */}
                            <img src={p.url} alt="" loading="lazy" className="aspect-[3/4] w-full object-cover" />
                            <span className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-xs text-white">{v.label}</span>
                          </button>
                        ) : (
                          <div className="flex aspect-[3/4] w-full items-center justify-center rounded-2xl border border-dashed border-border text-xs text-subtle">{v.label}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          {groupByDate(photos).length >= 2 && <Compare photos={photos} weightOn={weightOn} />}
          <Evolution photos={photos} weightOn={weightOn} />
        </>
      )}

      {adding && (
        <AddPhotosSheet
          today={today}
          onClose={() => setAdding(false)}
          onSaved={async () => {
            setAdding(false);
            await reload().catch(() => setError("Fotos guardadas, pero no se pudo refrescar la galería."));
          }}
        />
      )}

      {viewing && (
        <Sheet title={`${PHOTO_VIEWS.find((v) => v.id === viewing.view)?.label ?? ""} · ${longDate(viewing.taken_on, true)}`} onClose={() => setViewing(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal */}
          <img src={viewing.url} alt={`Foto de progreso del ${longDate(viewing.taken_on)}`} className="max-h-[60dvh] w-full rounded-2xl object-contain" />
          <p className="mt-3 text-sm text-subtle">
            {weightOn(viewing.taken_on) !== null ? `Peso cercano: ${nf(weightOn(viewing.taken_on)!)} kg` : "Sin peso registrado cerca de esta fecha"}
          </p>
          {viewing.note && <p className="mt-1 whitespace-pre-line text-sm">{viewing.note}</p>}
          <Button
            variant="secondary"
            className="mt-4 text-danger"
            onClick={async () => {
              if (!confirm("¿Borrar esta foto? No se puede deshacer.")) return;
              try {
                await deletePhoto(createClient(), viewing);
                setViewing(null);
                await reload();
              } catch {
                setError("No se pudo borrar la foto.");
                setViewing(null);
              }
            }}
          >
            Borrar foto
          </Button>
        </Sheet>
      )}
    </section>
  );
}


// Comparador: dos fechas lado a lado en la vista elegida, con los días transcurridos y la diferencia de peso.
function Compare({ photos, weightOn }: { photos: Photo[]; weightOn: (date: string) => number | null }) {
  const dates = useMemo(() => groupByDate(photos).map((g) => g.date).reverse(), [photos]); // de la más antigua a la más reciente
  const [before, setBefore] = useState(dates[0]);
  const [after, setAfter] = useState(dates[dates.length - 1]);
  const [view, setView] = useState<PhotoView>("front");
  const wb = weightOn(before), wa = weightOn(after);
  const days = daysBetween(before, after);

  return (
    <div className="mt-5 border-t border-border pt-4">
      <h3 className="mb-2 text-sm font-semibold text-subtle">Comparar</h3>
      <div role="group" aria-label="Vista" className="mb-3 flex rounded-full bg-muted p-0.5 text-sm font-semibold">
        {PHOTO_VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            aria-pressed={view === v.id}
            className={`flex-1 rounded-full py-2 transition ${view === v.id ? "bg-card shadow-sm" : "text-subtle"}`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {([["Antes", before, setBefore], ["Después", after, setAfter]] as const).map(([label, date, set]) => {
          const p = photos.find((c) => c.taken_on === date && c.view === view);
          return (
            <div key={label}>
              <Field label={label}>
                <select className={`${inputCls} h-11 text-sm`} value={date} onChange={(e) => set(e.target.value)}>
                  {dates.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              {p ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal
                <img src={p.url} alt={`${label}: ${date}`} className="mt-2 aspect-[3/4] w-full rounded-2xl object-cover" />
              ) : (
                <div className="mt-2 flex aspect-[3/4] w-full items-center justify-center rounded-2xl border border-dashed border-border px-2 text-center text-xs text-subtle">
                  Sin foto de {PHOTO_VIEWS.find((v) => v.id === view)?.label.toLowerCase()} este día
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 rounded-2xl bg-muted px-4 py-3 text-sm">
        {days === 0 ? "Misma fecha" : `${Math.abs(days)} días de diferencia`}
        {wb !== null && wa !== null && <> · <span className="font-semibold">{signed(wa - wb)} kg</span> ({nf(wb)} → {nf(wa)} kg)</>}
        {(wb === null || wa === null) && <span className="text-subtle"> · Registra tu peso esos días para ver la diferencia.</span>}
      </p>
    </div>
  );
}

// Evolución por fecha: peso y cambio respecto a la sesión de fotos anterior.
function Evolution({ photos, weightOn }: { photos: Photo[]; weightOn: (date: string) => number | null }) {
  const dates = groupByDate(photos).map((g) => g.date).reverse();
  return (
    <div className="mt-5 border-t border-border pt-4">
      <h3 className="mb-1 text-sm font-semibold text-subtle">Evolución</h3>
      <ul className="text-sm">
        {dates.map((d, i) => {
          const w = weightOn(d), prev = i > 0 ? dates[i - 1] : null, pw = prev ? weightOn(prev) : null;
          return (
            <li key={d} className="flex items-center gap-3 border-t border-border py-2 first:border-t-0">
              <span className="flex-1">{d}{prev && <span className="text-subtle"> · +{daysBetween(prev, d)} d</span>}</span>
              <span className="font-medium">{w !== null ? `${nf(w)} kg` : "—"}</span>
              <span className="w-16 text-right text-subtle">{w !== null && pw !== null ? `${signed(w - pw)} kg` : ""}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type Picked = { file: File; preview: string };

// Un hueco (frente, lado o espalda): elige o cambia la foto y muestra su vista previa.
function Slot({ label, picked, onPick }: { label: string; picked?: Picked; onPick: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={`Elegir foto de ${label.toLowerCase()}`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ""; // permite elegir la misma foto otra vez
          if (f) onPick(f);
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="relative flex aspect-[3/4] w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border border-dashed border-border bg-muted text-xs text-subtle"
      >
        {picked ? (
          // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:)
          <img src={picked.preview} alt={`Vista previa: ${label}`} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <Camera size={22} />
        )}
        <span className={picked ? "absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-white" : ""}>{label}</span>
      </button>
    </div>
  );
}

// Tres huecos (frente, lado, espalda) + fecha y nota; al guardar se comprimen y se suben las elegidas.
function AddPhotosSheet({ today, onClose, onSaved }: { today: string; onClose: () => void; onSaved: () => Promise<void> }) {
  // Las URLs de vista previa se liberan explícitamente al cambiar de foto, cerrar o guardar: revocarlas en la
  // limpieza de un efecto las rompería en desarrollo (React ejecuta los efectos dos veces) antes de pintarse.
  const [picked, setPicked] = useState<Partial<Record<PhotoView, Picked>>>({});
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = Object.keys(picked).length;

  const revokeAll = () => Object.values(picked).forEach((p) => URL.revokeObjectURL(p.preview));
  const close = () => {
    revokeAll();
    onClose();
  };

  function pick(view: PhotoView, file: File) {
    const old = picked[view];
    if (old) URL.revokeObjectURL(old.preview);
    setPicked((cur) => ({ ...cur, [view]: { file, preview: URL.createObjectURL(file) } }));
  }

  // Sube una a una; si alguna falla se queda abierto para reintentar (repetir una vista del mismo día la sustituye).
  async function save() {
    setBusy(true);
    setError(null);
    try {
      const sb = createClient();
      const userId = await currentUserId();
      for (const v of PHOTO_VIEWS) {
        const p = picked[v.id];
        if (p) await uploadPhoto(sb, userId, await resizeImage(p.file), date, v.id, note.trim() || null);
      }
      revokeAll();
      await onSaved();
    } catch {
      setError("No se pudieron guardar todas las fotos. Comprueba la conexión e inténtalo de nuevo.");
      setBusy(false);
    }
  }

  return (
    <Sheet title="Nuevas fotos" onClose={close} error={error}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          {PHOTO_VIEWS.map((v) => (
            <Slot key={v.id} label={v.label} picked={picked[v.id]} onPick={(f) => pick(v.id, f)} />
          ))}
        </div>
        <p className="-mt-2 text-xs text-subtle">No hace falta subir las tres: elige las que quieras.</p>
        <Field label="Fecha">
          <input type="date" className={inputCls} value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </Field>
        <Field label="Nota (opcional)">
          <input className={inputCls} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Ej. en ayunas, misma luz" />
        </Field>
        <Button onClick={save} disabled={busy || count === 0}>
          {busy ? "Subiendo…" : count === 0 ? "Elige al menos una foto" : count === 1 ? "Guardar 1 foto" : `Guardar ${count} fotos`}
        </Button>
      </div>
    </Sheet>
  );
}
