"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function addPayment(formData: FormData) {
  await requireUser();
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
}

export async function addExpense(formData: FormData) {
  await requireUser();
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
}

export async function markExpensePaid(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id"));
  await db()
    .from("expenses")
    .update({ paid_at: new Date().toISOString().slice(0, 10) })
    .eq("id", id);
  revalidatePath("/admin/financeiro");
}
