"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";

function back(msg: string, ok = true) {
  redirect(`/admin/usuarios?${ok ? "ok" : "erro"}=${encodeURIComponent(msg)}`);
}

/** Dono cria professor (ou outro dono): usuário no Auth + perfil. */
export async function createTeacher(formData: FormData) {
  await requireOwner();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "professor");
  if (!name || !email || password.length < 6) {
    back("Preencha nome, e-mail e senha (mín. 6 caracteres).", false);
  }

  const { data, error } = await db().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    back(`Erro ao criar usuário: ${error?.message ?? "desconhecido"}`, false);
    return;
  }

  await db().from("profiles").insert({
    id: data.user.id,
    name,
    role: role === "dono" ? "dono" : "professor",
  });

  revalidatePath("/admin/usuarios");
  back(`${role === "dono" ? "Dono" : "Professor"} ${name} criado com sucesso.`);
}

/** Dono altera papel (dono/professor). */
export async function setRole(formData: FormData) {
  const me = await requireOwner();
  const id = String(formData.get("id"));
  const role = String(formData.get("role"));
  if (!["dono", "professor"].includes(role)) return;
  if (id === me.id && role !== "dono") {
    back("Você não pode remover seu próprio papel de dono.", false);
  }
  await db().from("profiles").update({ role }).eq("id", id);
  revalidatePath("/admin/usuarios");
  back("Papel atualizado.");
}

/** Dono ativa/desativa professor (desativado não consegue logar). */
export async function toggleActive(formData: FormData) {
  const me = await requireOwner();
  const id = String(formData.get("id"));
  const active = formData.get("active") === "1";
  if (id === me.id && !active) {
    back("Você não pode desativar a si mesmo.", false);
  }
  await db().from("profiles").update({ active }).eq("id", id);
  revalidatePath("/admin/usuarios");
  back(active ? "Usuário reativado." : "Usuário desativado.");
}

/** Dono redefine a senha de um professor. */
export async function resetPassword(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("id"));
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) back("Senha deve ter no mínimo 6 caracteres.", false);
  const { error } = await db().auth.admin.updateUserById(id, { password });
  if (error) back(`Erro: ${error.message}`, false);
  back("Senha redefinida.");
}

/** Dono exclui aluno (cliente). Inscrições e assinaturas caem em cascata. */
export async function deleteClientUser(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("id"));
  const { error } = await db().from("clients").delete().eq("id", id);
  if (error) {
    back(`Erro ao excluir: ${error.message}`, false);
    return;
  }
  revalidatePath("/admin/clientes");
  back("Aluno excluído (inscrições, assinaturas e reposições removidas).");
}

/** Dono gera um novo link de acesso para o aluno (invalida o anterior). */
export async function rotateClientToken(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("id"));
  // novo token aleatório gerado pelo banco
  const { error } = await db().rpc("rotate_client_token", { p_client_id: id });
  if (error) {
    back(`Erro ao gerar novo link: ${error.message}`, false);
    return;
  }
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/usuarios");
  back("Novo link gerado — o link antigo deixou de funcionar.");
}
