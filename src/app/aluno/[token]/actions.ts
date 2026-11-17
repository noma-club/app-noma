"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { enrollClient, cancelEnrollment } from "@/lib/enrollment";

async function clientByToken(token: string) {
  const { data } = await db()
    .from("clients")
    .select("id")
    .eq("access_token", token)
    .single();
  return data;
}

export async function alunoEnroll(formData: FormData) {
  const token = String(formData.get("token"));
  const classId = String(formData.get("class_id"));
  const asMakeup = formData.get("as_makeup") === "1";
  const client = await clientByToken(token);
  if (!client) return;
  await enrollClient(classId, client.id, { asMakeup });
  revalidatePath(`/aluno/${token}`);
}

export async function alunoCancel(formData: FormData) {
  const token = String(formData.get("token"));
  const classId = String(formData.get("class_id"));
  const client = await clientByToken(token);
  if (!client) return;
  await cancelEnrollment(classId, client.id);
  revalidatePath(`/aluno/${token}`);
}
