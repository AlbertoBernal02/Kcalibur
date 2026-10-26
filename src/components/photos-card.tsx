"use client";

import { Camera } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resizeImage } from "@/lib/image";
import { deletePhoto, listPhotos, uploadPhoto, type Photo } from "@/lib/data/photos";
import { loadWeights, type WeightPoint } from "@/lib/data/tracking";
import { addDays, longDate } from "@/lib/meals";
import { daysBetween, nearestWeight, nextPhotoInfo } from "@/lib/photos";
import { createClient, currentUserId } from "@/lib/supabase/client";
import { Sheet } from "@/components/sheet";
import { Button, Field, inputCls } from "@/components/ui";

const nf = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${nf(Math.abs(n))}`;

// Fotos de progreso: recordatorio quincenal, galería, comparador antes/después y evolución.
export function PhotosCard({ today }: { today: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [weights, setWeights] = useState<WeightPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
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

  const weightOf = (p: Photo) => nearestWeight(weights, p.taken_on);
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

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Elegir foto"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ""; // permite elegir la misma foto otra vez
          if (f) setFile(f);
        }}
      />
      <Button type="button" onClick={() => fileRef.current?.click()} className="mt-3 flex items-center justify-center gap-2">
        <Camera size={20} /> Añadir foto
      </Button>

      {error && <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      {photos && photos.length > 0 && (
        <>
          <ul className="mt-4 grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <li key={p.id}>
                <button onClick={() => setViewing(p)} aria-label={`Ver foto del ${longDate(p.taken_on)}`} className="relative block w-full overflow-hidden rounded-2xl bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal: next/image no aporta */}
                  <img src={p.url} alt="" loading="lazy" className="aspect-[3/4] w-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-xs text-white">{p.taken_on.slice(5).split("-").reverse().join("/")}</span>
                </button>
              </li>
            ))}
          </ul>
          {photos.length >= 2 && <Compare photos={photos} weightOf={weightOf} />}
          <Evolution photos={photos} weightOf={weightOf} />
        </>
      )}

      {file && (
        <AddPhotoSheet
          file={file}
          today={today}
          onClose={() => setFile(null)}
          onSaved={async () => {
            setFile(null);
            await reload().catch(() => setError("Foto guardada, pero no se pudo refrescar la galería."));
          }}
        />
      )}

      {viewing && (
        <Sheet title={longDate(viewing.taken_on, true)} onClose={() => setViewing(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal */}
          <img src={viewing.url} alt={`Foto de progreso del ${longDate(viewing.taken_on)}`} className="max-h-[60dvh] w-full rounded-2xl object-contain" />
          <p className="mt-3 text-sm text-subtle">
            {weightOf(viewing) !== null ? `Peso cercano: ${nf(weightOf(viewing)!)} kg` : "Sin peso registrado cerca de esta fecha"}
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

// Comparador: dos fotos lado a lado con los días transcurridos y la diferencia de peso.
function Compare({ photos, weightOf }: { photos: Photo[]; weightOf: (p: Photo) => number | null }) {
  const chrono = useMemo(() => [...photos].reverse(), [photos]); // de la más antigua a la más reciente
  const [beforeId, setBeforeId] = useState(chrono[0].id);
  const [afterId, setAfterId] = useState(chrono[chrono.length - 1].id);
  const before = photos.find((p) => p.id === beforeId) ?? chrono[0];
  const after = photos.find((p) => p.id === afterId) ?? chrono[chrono.length - 1];
  const wb = weightOf(before), wa = weightOf(after);
  const days = daysBetween(before.taken_on, after.taken_on);

  return (
    <div className="mt-5 border-t border-border pt-4">
      <h3 className="mb-2 text-sm font-semibold text-subtle">Comparar</h3>
      <div className="grid grid-cols-2 gap-2">
        {([["Antes", before, setBeforeId], ["Después", after, setAfterId]] as const).map(([label, p, set]) => (
          <div key={label}>
            <Field label={label}>
              <select className={`${inputCls} h-11 text-sm`} value={p.id} onChange={(e) => set(e.target.value)}>
                {chrono.map((c) => <option key={c.id} value={c.id}>{c.taken_on}</option>)}
              </select>
            </Field>
            {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal */}
            <img src={p.url} alt={`${label}: ${p.taken_on}`} className="mt-2 aspect-[3/4] w-full rounded-2xl object-cover" />
          </div>
        ))}
      </div>
      <p className="mt-3 rounded-2xl bg-muted px-4 py-3 text-sm">
        {days === 0 ? "Misma fecha" : `${Math.abs(days)} días de diferencia`}
        {wb !== null && wa !== null && <> · <span className="font-semibold">{signed(wa - wb)} kg</span> ({nf(wb)} → {nf(wa)} kg)</>}
        {(wb === null || wa === null) && <span className="text-subtle"> · Registra tu peso esos días para ver la diferencia.</span>}
      </p>
    </div>
  );
}

// Evolución foto a foto: peso y cambio respecto a la foto anterior.
function Evolution({ photos, weightOf }: { photos: Photo[]; weightOf: (p: Photo) => number | null }) {
  const chrono = [...photos].reverse();
  return (
    <div className="mt-5 border-t border-border pt-4">
      <h3 className="mb-1 text-sm font-semibold text-subtle">Evolución</h3>
      <ul className="text-sm">
        {chrono.map((p, i) => {
          const w = weightOf(p), prev = i > 0 ? chrono[i - 1] : null, pw = prev ? weightOf(prev) : null;
          return (
            <li key={p.id} className="flex items-center gap-3 border-t border-border py-2 first:border-t-0">
              <span className="flex-1">{p.taken_on}{prev && <span className="text-subtle"> · +{daysBetween(prev.taken_on, p.taken_on)} d</span>}</span>
              <span className="font-medium">{w !== null ? `${nf(w)} kg` : "—"}</span>
              <span className="w-16 text-right text-subtle">{w !== null && pw !== null ? `${signed(w - pw)} kg` : ""}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Vista previa + fecha y nota; al guardar se comprime y se sube.
function AddPhotoSheet({ file, today, onClose, onSaved }: { file: File; today: string; onClose: () => void; onSaved: () => Promise<void> }) {
  // La URL se libera explícitamente al cerrar/guardar: revocarla en la limpieza de un efecto la rompería
  // en desarrollo (React ejecuta los efectos dos veces) antes de llegar a pintarse.
  const [preview] = useState(() => URL.createObjectURL(file));
  const close = () => {
    URL.revokeObjectURL(preview);
    onClose();
  };
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const blob = await resizeImage(file);
      await uploadPhoto(createClient(), await currentUserId(), blob, date, note.trim() || null);
      URL.revokeObjectURL(preview);
      await onSaved();
    } catch {
      setError("No se pudo guardar la foto. Comprueba la conexión e inténtalo de nuevo.");
      setBusy(false);
    }
  }

  return (
    <Sheet title="Nueva foto" onClose={close} error={error}>
      <div className="flex flex-col gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:) */}
        <img src={preview} alt="Vista previa" className="max-h-[45dvh] w-full rounded-2xl object-contain" />
        <Field label="Fecha">
          <input type="date" className={inputCls} value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </Field>
        <Field label="Nota (opcional)">
          <input className={inputCls} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Ej. en ayunas, misma luz" />
        </Field>
        <Button onClick={save} disabled={busy}>{busy ? "Subiendo…" : "Guardar foto"}</Button>
      </div>
    </Sheet>
  );
}
