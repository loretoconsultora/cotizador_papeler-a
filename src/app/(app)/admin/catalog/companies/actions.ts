"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function createCompanyAction(formData: FormData) {
  await requireRole("admin");

  const name = String(formData.get("name") ?? "").trim();
  const shortCode = String(formData.get("short_code") ?? "")
    .trim()
    .toUpperCase();

  if (!name || !shortCode) {
    throw new Error("Nombre y código son obligatorios.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("companies").insert({ name, short_code: shortCode });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/catalog/companies");
  // El selector de empresas en Vendedores y Productos depende de esta tabla.
  revalidatePath("/admin/sellers");
  revalidatePath("/admin/catalog/products");
}

export async function toggleCompanyActiveAction(formData: FormData) {
  await requireRole("admin");

  const companyId = String(formData.get("company_id") ?? "");
  const nextActive = formData.get("active") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ active: nextActive })
    .eq("id", companyId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/catalog/companies");
}
