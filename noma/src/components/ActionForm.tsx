"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Formulário que, ao terminar a Server Action, força o refresh dos
 * dados da tela — sem recarregar o site inteiro.
 *
 * Por que isso existe: no OpenNext/Cloudflare o revalidatePath()
 * sozinho nem sempre chega a atualizar a árvore já renderizada no
 * cliente, e a alteração só aparecia depois de um F5. Chamando
 * router.refresh() ao fim da ação, a lista é refeita no servidor e
 * trocada na tela na hora.
 */
export default function ActionForm({
  action,
  children,
  className,
  reset = true,
  confirm,
}: {
  action: (formData: FormData) => Promise<void>;
  children: React.ReactNode;
  className?: string;
  /** Limpa os campos após gravar (útil nos formulários de "adicionar"). */
  reset?: boolean;
  /** Se definido, pede confirmação antes de executar. */
  confirm?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      className="af-form"
      data-pending={pending ? "1" : undefined}
      action={(formData) => {
        if (confirm && !window.confirm(confirm)) return;
        startTransition(async () => {
          await action(formData);
          if (reset) formRef.current?.reset();
          router.refresh();
        });
      }}
    >
      <fieldset disabled={pending} className={`af-fieldset ${className ?? ""}`}>
        {children}
      </fieldset>
    </form>
  );
}
