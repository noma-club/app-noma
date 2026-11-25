"use client";

import { useEffect, useState } from "react";

/**
 * Mostra o link COMPLETO do aluno (com domínio) e um botão que copia
 * para a área de transferência, pronto para mandar no WhatsApp.
 *
 * O domínio só é conhecido no navegador, então montamos a URL no
 * cliente a partir de window.location.origin.
 */
export default function CopyLink({ token }: { token: string }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}/aluno/${token}`);
  }, [token]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Navegadores sem permissão de clipboard: seleciona para copiar à mão
      const el = document.getElementById(`lk-${token}`) as HTMLInputElement | null;
      el?.select();
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="copy-link">
      <input
        id={`lk-${token}`}
        className="mono"
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Link do aluno"
      />
      <button type="button" className="btn-sm" onClick={copy} disabled={!url}>
        {copied ? "Copiado ✓" : "Copiar"}
      </button>
    </div>
  );
}
