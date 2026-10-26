import { fitWithin } from "@/lib/photos";

// Reduce una foto del móvil (varios MB) a un JPEG ligero antes de subirla.
// Se carga con <img> porque aplica la orientación EXIF (si no, las fotos del iPhone salen giradas).
export async function resizeImage(file: File, max = 1280, quality = 0.82): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, max);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas no disponible");
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no se pudo comprimir"))), "image/jpeg", quality),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
