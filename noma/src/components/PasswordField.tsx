"use client";

import { useState } from "react";

/**
 * Campo de senha com botão "mostrar/ocultar" (ícone de olho).
 * Mantém name/required/autoComplete para que o POST do formulário
 * continue funcionando igual a um <input> comum.
 */
export default function PasswordField({
  name = "password",
  autoComplete = "current-password",
  placeholder,
  required = true,
}: {
  name?: string;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="pw-wrap">
      <input
        name={name}
        type={show ? "text" : "password"}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
      />
      <button
        type="button"
        className="pw-toggle"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={show}
        title={show ? "Ocultar senha" : "Mostrar senha"}
      >
        {show ? (
          // olho cortado (ocultar)
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3 3l18 18M10.6 10.7a2 2 0 002.8 2.8M9.4 5.2A9.5 9.5 0 0112 5c5 0 9 4 10 7a12 12 0 01-2.4 3.4M6.1 6.3C3.8 7.8 2.3 9.9 2 12c1 3 5 7 10 7a9.6 9.6 0 004-0.9"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          // olho aberto (mostrar)
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        )}
      </button>
    </div>
  );
}
