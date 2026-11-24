"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { check } from "@/lib/dbwrite";

/** Telas que consomem esses cadastros e precisam refletir a mudança. */
function revalidateAll() {
  revalidatePath("/admin/cadastros");
  revalidatePath("/admin/agenda");
  revalidatePath("/admin/financeiro");
  revalidatePath("/admin");
}

const BACK = "/admin/cadastros";

function clean(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim().replace(/\s+/g, " ");
}

function toInt(v: FormDataEntryValue | null, fallback = 0): number {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

/* ================= Modalidades (class_types) ================= */

export async function createClassType(formData: FormData) {
  await requireOwner();
  const name = clean(formData.get("name"));
  const max_students = toInt(formData.get("max_students"));
  if (!name || max_students <= 0) return;
  check(await db().from("class_types").insert({ name, max_students, active: true }),
    BACK, "Criar modalidade");
  revalidateAll();
}

export async function updateClassType(formData: FormData) {
  await requireOwner();
  const id = clean(formData.get("id"));
  const name = clean(formData.get("name"));
  const max_students = toInt(formData.get("max_students"));
  if (!id || !name || max_students <= 0) return;
  check(await db().from("class_types").update({ name, max_students }).eq("id", id),
    BACK, "Salvar modalidade");
  revalidateAll();
}

export async function toggleClassType(formData: FormData) {
  await requireOwner();
  const id = clean(formData.get("id"));
  if (!id) return;
  check(await db()
    .from("class_types")
    .update({ active: formData.get("active") === "1" })
    .eq("id", id), BACK, "Alterar status");
  revalidateAll();
}

/* ===================== Salas (spaces) ===================== */

export async function createSpace(formData: FormData) {
  await requireOwner();
  const name = clean(formData.get("name"));
  const capacity = toInt(formData.get("capacity"));
  if (!name || capacity <= 0) return;
  check(await db().from("spaces").insert({ name, capacity, active: true }),
    BACK, "Criar sala");
  revalidateAll();
}

export async function updateSpace(formData: FormData) {
  await requireOwner();
  const id = clean(formData.get("id"));
  const name = clean(formData.get("name"));
  const capacity = toInt(formData.get("capacity"));
  if (!id || !name || capacity <= 0) return;
  check(await db().from("spaces").update({ name, capacity }).eq("id", id),
    BACK, "Salvar sala");
  revalidateAll();
}

export async function toggleSpace(formData: FormData) {
  await requireOwner();
  const id = clean(formData.get("id"));
  if (!id) return;
  check(await db()
    .from("spaces")
    .update({ active: formData.get("active") === "1" })
    .eq("id", id), BACK, "Alterar status");
  revalidateAll();
}

/* ================ Categorias (recebimento / despesa) ================ */

function catName(formData: FormData): string {
  return clean(formData.get("name")).toLowerCase();
}

export async function createIncomeCategory(formData: FormData) {
  await requireOwner();
  const name = catName(formData);
  if (!name) return;
  check(await db()
    .from("income_categories")
    .upsert({ name, active: true }, { onConflict: "name" }),
    BACK, "Criar categoria");
  revalidateAll();
}

export async function toggleIncomeCategory(formData: FormData) {
  await requireOwner();
  const id = clean(formData.get("id"));
  if (!id) return;
  check(await db()
    .from("income_categories")
    .update({ active: formData.get("active") === "1" })
    .eq("id", id), BACK, "Alterar status");
  revalidateAll();
}

export async function createExpenseCategory(formData: FormData) {
  await requireOwner();
  const name = catName(formData);
  if (!name) return;
  check(await db()
    .from("expense_categories")
    .upsert({ name, active: true }, { onConflict: "name" }),
    BACK, "Criar categoria");
  revalidateAll();
}

export async function toggleExpenseCategory(formData: FormData) {
  await requireOwner();
  const id = clean(formData.get("id"));
  if (!id) return;
  check(await db()
    .from("expense_categories")
    .update({ active: formData.get("active") === "1" })
    .eq("id", id), BACK, "Alterar status");
  revalidateAll();
}
