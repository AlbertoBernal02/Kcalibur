"use client";

import { ScanBarcode, Search } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { inputBase } from "@/components/ui";

// Buscador con icono de lupa y botón de cámara que abre el escáner de códigos de barras.
export function SearchBox({ value, onChange, onScan, height = "h-14" }: {
  value: string;
  onChange: (v: string) => void;
  onScan: (code: string) => void;
  height?: string;
}) {
  const [scanning, setScanning] = useState(false);
  return (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-subtle" size={20} />
      <input
        type="search"
        placeholder="Buscar alimento…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputBase} ${height} w-full pl-12 pr-14`}
      />
      <button
        type="button"
        onClick={() => setScanning(true)}
        aria-label="Escanear código de barras"
        className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-primary active:bg-muted"
      >
        <ScanBarcode size={24} />
      </button>
      {/* Portal a <body>: un ancestro con backdrop-filter (cabecera fija) rompería el position:fixed */}
      {scanning &&
        createPortal(
          <BarcodeScanner
            onClose={() => setScanning(false)}
            onCode={(code) => {
              setScanning(false);
              onScan(code);
            }}
          />,
          document.body,
        )}
    </div>
  );
}
