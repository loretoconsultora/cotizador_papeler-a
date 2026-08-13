"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Alta de vendedor: crea la cuenta de auth (Admin API, sin correo de
 * confirmación) + su perfil + la matriz inicial de empresas asignadas.
 * Nunca hay autorregistro público — solo el admin da de alta cuentas.
 */
export async function createSellerAction(formData: FormData) {
  await requireRole("admin");

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const companyIds = formData.getAll("company_ids").map(String);

  if (!fullName || !email || !password) {
    throw new Error("Nombre, correo y contraseña son obligatorios.");
  }

  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    throw new Error(createError?.message ?? "No se pudo crear la cuenta.");
  }

  const supabase = await createClient();

  const { error: profileError } = await supabase.from("profiles").insert({
    id: created.user.id,
    full_name: fullName,
    role: "seller",
    active: true,
  });

  if (profileError) {
    // Sin perfil la cuenta queda inservible (requireProfile la rechaza) —
    // mejor revertir el alta en auth que dejar una cuenta huérfana.
    await admin.auth.admin.deleteUser(created.user.id);
    throw new Error(profileError.message);
  }

  if (companyIds.length > 0) {
    const rows = companyIds.map((companyId) => ({
      seller_id: created.user.id,
      company_id: companyId,
    }));
    const { error: matrixError } = await supabase.from("seller_companies").insert(rows);
    if (matrixError) throw new Error(matrixError.message);
  }

  revalidatePath("/admin/sellers");
}

/** Reemplaza por completo la matriz de empresas asignadas a un vendedor. */
export async function updateSellerCompaniesAction(formData: FormData) {
  await requireRole("admin");

  const sellerId = String(formData.get("seller_id") ?? "");
  const companyIds = formData.getAll("company_ids").map(String);

  if (!sellerId) throw new Error("Falta el vendedor.");

  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("seller_companies")
    .delete()
    .eq("seller_id", sellerId);
  if (deleteError) throw new Error(deleteError.message);

  if (companyIds.length > 0) {
    const rows = companyIds.map((companyId) => ({ seller_id: sellerId, company_id: companyId }));
    const { error: insertError } = await supabase.from("seller_companies").insert(rows);
    if (insertError) throw new Error(insertError.message);
  }

  revalidatePath("/admin/sellers");
}

/** Activa/desactiva una cuenta sin borrar su historial de cotizaciones. */
export async function toggleSellerActiveAction(formData: FormData) {
  await requireRole("admin");

  const sellerId = String(formData.get("seller_id") ?? "");
  const nextActive = formData.get("active") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ active: nextActive })
    .eq("id", sellerId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/sellers");
}
