"use client";

/**
 * Botão de submit que pede confirmação antes de enviar o form.
 * Usado em ações destrutivas ou sensíveis (excluir, mudar papel, desativar)
 * para evitar cliques acidentais.
 */
export default function ConfirmButton({
  children,
  message,
  className = "btn-sm btn-danger",
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
