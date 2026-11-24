"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { enrollClient, cancelEnrollment } from "@/lib/enrollment";

export async function createClass(formData: FormData) {
  await requireOwner();
  const typeId = String(formData.get("class_type_id"));
  const spaceId = String(formData.get("space_id"));
  const teacherId = String(formData.get("teacher_id"));
  const date = String(formData.get("date"));
  const time = String(formData.get("time"));
  const released = Number(formData.get("released_spots"));
  if (!typeId || !spaceId || !teacherId || !date || !time) return;

  const [{ data: type }, { data: space }] = await Promise.all([
    db().from("class_types").select("max_students").eq("id", typeId).single(),
    db().from("spaces").select("capacity").eq("id", spaceId).single(),
  ]);
  if (!type || !space) return;

  // Capacidade real = menor entre modalidade e espaço
  const capacity = Math.min(type.max_students, space.capacity);
  const releasedSpots = Math.min(released || capacity, capacity);

  // Horário local do estúdio (America/Sao_Paulo, UTC-03)
  const startsAt = new Date(`${date}T${time}:00-03:00`).toISOString();

  await db().from("classes").insert({
    class_type_id: typeId,
    space_id: spaceId,
    teacher_id: teacherId,
    starts_at: startsAt,
    duration_min: Number(formData.get("duration_min") || 60),
    capacity,
    released_spots: releasedSpots,
  });
  revalidatePath("/admin/agenda");
}

export async function deleteClass(formData: FormData) {
  await requireOwner();
  await db().from("classes").delete().eq("id", String(formData.get("id")));
  revalidatePath("/admin/agenda");
}

export async function adminEnroll(formData: FormData) {
  await requireOwner();
  await enrollClient(String(formData.get("class_id")), String(formData.get("client_id")), {
    byAdmin: true,
  });
  revalidatePath(`/admin/agenda/${formData.get("class_id")}`);
}

export async function adminCancel(formData: FormData) {
  await requireOwner();
  await cancelEnrollment(String(formData.get("class_id")), String(formData.get("client_id")), {
    byAdmin: true,
  });
  revalidatePath(`/admin/agenda/${formData.get("class_id")}`);
}

/** Chamada: professor marca presença/falta. */
export async function setAttendance(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("enrollment_id"));
  const status = String(formData.get("status")); // presente | falta
  if (!["presente", "falta", "inscrito"].includes(status)) return;
  await db().from("enrollments").update({ status }).eq("id", id);
  revalidatePath(`/admin/agenda/${formData.get("class_id")}`);
}
