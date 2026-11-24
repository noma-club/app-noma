"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";

/* ---------------- Lançamentos ---------------- */

export async function addPayment(formData: FormData) {
  await requireOwner();
  const amount = Number(formData.get("amount"));
  if (!amount || amount <= 0) return;
  await db().from("payments").insert({
    client_id: String(formData.get("client_id") || "") || null,
    description: String(formData.get("description") ?? "Recebimento"),
    kind: String(formData.get("kind") ?? "outro"),
    amount,
    method: String(formData.get("method") ?? "pix"),
    paid_at: String(formData.get("paid_at") || new Date().toISOString().slice(0, 10)),
  });
  revalidatePath("/admin/financeiro");
  revalidatePath("/admin/financeiro/relatorios");
}

export async function addExpense(formData: FormData) {
  await requireOwner();
  const amount = Number(formData.get("amount"));
  if (!amount || amount <= 0) return;
  const recurring = formData.get("recurring") === "on";
  await db().from("expenses").insert({
    description: String(formData.get("description") ?? "Despesa"),
    category: String(formData.get("category") ?? "outro"),
    amount,
    recurring,
    due_day: recurring ? Number(formData.get("due_day") || 10) : null,
    paid_at: String(formData.get("paid_at") || "") || null,
    reference_month: `${String(formData.get("reference_month") || new Date().toISOString().slice(0, 7))}-01`,
  });
  revalidatePath("/admin/financeiro");
  revalidatePath("/admin/financeiro/relatorios");
}

export async function markExpensePaid(formData: FormData) {
  await requireOwner();
  await db()
    .from("expenses")
    .update({ paid_at: new Date().toISOString().slice(0, 10) })
    .eq("id", String(formData.get("id")));
  revalidatePath("/admin/financeiro");
}

export async function deleteExpense(formData: FormData) {
  await requireOwner();
  await db().from("expenses").delete().eq("id", String(formData.get("id")));
  revalidatePath("/admin/financeiro");
  revalidatePath("/admin/financeiro/relatorios");
}

export async function deletePayment(formData: FormData) {
  await requireOwner();
  await db().from("payments").delete().eq("id", String(formData.get("id")));
  revalidatePath("/admin/financeiro");
  revalidatePath("/admin/financeiro/relatorios");
}

/* ---------------- Categorias customizáveis ---------------- */

function normalizeCat(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function addExpenseCategory(formData: FormData) {
  await requireOwner();
  const name = normalizeCat(String(formData.get("name") ?? ""));
  if (!name) return;
  await db().from("expense_categories").upsert({ name, active: true }, { onConflict: "name" });
  revalidatePath("/admin/financeiro");
}

export async function toggleExpenseCategory(formData: FormData) {
  await requireOwner();
  await db()
    .from("expense_categories")
    .update({ active: formData.get("active") === "1" })
    .eq("id", String(formData.get("id")));
  revalidatePath("/admin/financeiro");
}

export async function addIncomeCategory(formData: FormData) {
  await requireOwner();
  const name = normalizeCat(String(formData.get("name") ?? ""));
  if (!name) return;
  await db().from("income_categories").upsert({ name, active: true }, { onConflict: "name" });
  revalidatePath("/admin/financeiro");
}

export async function toggleIncomeCategory(formData: FormData) {
  await requireOwner();
  await db()
    .from("income_categories")
    .update({ active: formData.get("active") === "1" })
    .eq("id", String(formData.get("id")));
  revalidatePath("/admin/financeiro");
}
