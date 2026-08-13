"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/require-user";

/**
 * El propio vendedor edita su nombre, teléfono y correo de contacto (el que
 * aparece en las cotizaciones que descarga). RLS permite update propio desde
 * la migración 0006, pero un trigger bloquea que se toque role/active desde
 * aquí — por eso ni siquiera se envían esos campos.
 */
export async function updateProfileAction(formData: FormData) {
  const { supabase, user } = await requireProfile();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const contactEmail = String(formData.get("contact_email") ?? "").trim() || null;

  if (!fullName) throw new Error("El nombre no puede quedar vacío.");

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone, contact_email: contactEmail })
    .eq("id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/profile");
  revalidatePath("/dashboard");
}

/** Sube (o reemplaza) la foto de perfil, mostrada en el nav junto al nombre. */
export async function uploadAvatarAction(formData: FormData) {
  const { supabase, user } = await requireProfile();

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Selecciona una imagen.");
  }

  const path = `${user.id}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/quotes");
}
