"use client";

export default function PrintButton() {
  return (
    <button type="button" className="btn-sm btn-outline hide-print" onClick={() => window.print()}>
      🖨️ Imprimir / PDF
    </button>
  );
}
