import type { MetadataRoute } from "next";

// Manifiesto de la PWA (se sirve en /manifest.webmanifest).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kcalibur",
    short_name: "Kcalibur",
    description: "Calorías y macros, sin complicaciones.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0c1210",
    theme_color: "#0c1210",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
