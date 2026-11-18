"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { validatePassword, normalizeUsername } from "@/lib/password";

function back(msg: string, ok = true) {
  redirect(`/admin/usuarios?${ok ? "ok" : "erro"}=${encodeURIComponent(msg)}`);
}

/** Cria professor/dono: usuário + senha (sem e-mail). */
export async function createUser(formData: FormData) {
  await requireOwner();
  const name = String(formData.get("name") ?? "").trim();
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "professor");

  if (!name || !username) back("Preencha nome e usuário.", false);
  if (!/^[a-z0-9._-]{3,}$/.test(username)) {
    back("Usuário deve ter 3+ caracteres: letras, números, ponto, hífen ou underline.", false);
  }
  const pwErr = validatePassword(password);
  if (pwErr) back(pwErr, false);

  const { error } = await db().rpc("create_app_user", {
    p_username: username,
    p_name: name,
    p_role: role === "dono" ? "dono" : "professor",
    p_password: password,
  });

  if (error) {
    if (String(error.message).includes("USERNAME_TAKEN")) back("Esse usuário já existe.", false);
    back(`Erro ao criar: ${error.message}`, false);
  }

  revalidatePath("/admin/usuarios");
  back(`${role === "dono" ? "Dono" : "Professor"} "${name}" criado. Usuário: ${username}`);
}

export async function setRole(formData: FormData) {
  const me = await requireOwner();
  const id = String(formData.get("id"));
  const role = String(formData.get("role"));
  if (!["dono", "professor"].includes(role)) return;
  if (id === me.id && role !== "dono") back("Você não pode remover seu próprio papel de dono.", false);
  await db().from("profiles").update({ role }).eq("id", id);
  revalidatePath("/admin/usuarios");
  back("Papel atualizado.");
}

export async function toggleActive(formData: FormData) {
  const me = await requireOwner();
  const id = String(formData.get("id"));
  const active = formData.get("active") === "1";
  if (id === me.id && !active) back("Você não pode desativar a si mesmo.", false);
  await db().from("profiles").update({ active }).eq("id", id);
  revalidatePath("/admin/usuarios");
  back(active ? "Usuário reativado." : "Usuário desativado.");
}

export async function resetPassword(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("id"));
  const password = String(formData.get("password") ?? "");
  const pwErr = validatePassword(password);
  if (pwErr) back(pwErr, false);
  const { error } = await db().rpc("set_app_user_password", { p_id: id, p_password: password });
  if (error) back(`Erro: ${error.message}`, false);
  back("Senha redefinida.");
}

export async function deleteClientUser(formData: FormData) {
  await requireOwner();
  const { error } = await db().from("clients").delete().eq("id", String(formData.get("id")));
  if (error) back(`Erro ao excluir: ${error.message}`, false);
  revalidatePath("/admin/clientes");
  back("Aluno excluído (inscrições, assinaturas e reposições removidas).");
}

export async function rotateClientToken(formData: FormData) {
  await requireOwner();
  const { error } = await db().rpc("rotate_client_token", { p_client_id: String(formData.get("id")) });
  if (error) back(`Erro ao gerar novo link: ${error.message}`, false);
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/usuarios");
  back("Novo link gerado — o link antigo deixou de funcionar.");
}
