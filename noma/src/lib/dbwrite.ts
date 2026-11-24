import { redirect } from "next/navigation";

/** Formato do retorno do supabase-js em gravações. */
type WriteResult = { error: { message: string } | null };

/**
 * Faz o erro do banco APARECER na tela em vez de sumir.
 *
 * Por que isso existe: as gravações eram escritas como
 *     await db().from("clients").insert({...});
 * sem ler o `error`. Quando o banco recusava (RLS, constraint,
 * chave errada), o app seguia como se tivesse dado certo e o
 * usuário via "nada acontece" — sem nenhuma pista do motivo.
 *
 * Uso:
 *     check(await db().from("clients").insert({...}), "/admin/clientes", "Criar cliente");
 */
export function check(res: WriteResult, backTo: string, what: string): void {
  if (res?.error) {
    const msg = res.error.message || "erro desconhecido";
    redirect(`${backTo}?erro=${encodeURIComponent(`${what} falhou — ${msg}`)}`);
  }
}
