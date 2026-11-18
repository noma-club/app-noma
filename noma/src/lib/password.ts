/**
 * Regras de senha (exigência do cliente):
 *  - mínimo 8 caracteres
 *  - ao menos 1 letra maiúscula
 *  - ao menos 1 letra minúscula
 *  - ao menos 1 caractere especial
 * Retorna uma mensagem de erro, ou null se a senha é válida.
 */
export function validatePassword(pw: string): string | null {
  if (!pw || pw.length < 8) return "A senha deve ter no mínimo 8 caracteres.";
  if (!/[A-Z]/.test(pw)) return "A senha deve conter ao menos uma letra maiúscula.";
  if (!/[a-z]/.test(pw)) return "A senha deve conter ao menos uma letra minúscula.";
  if (!/[^A-Za-z0-9]/.test(pw)) return "A senha deve conter ao menos um caractere especial (ex.: ! @ # $ %).";
  return null;
}

export const PASSWORD_HINT =
  "Mínimo 8 caracteres, com maiúscula, minúscula e caractere especial.";

/** Normaliza o nome de usuário: minúsculo, sem espaços nas pontas. */
export function normalizeUsername(raw: string): string {
  return (raw ?? "").trim().toLowerCase();
}
