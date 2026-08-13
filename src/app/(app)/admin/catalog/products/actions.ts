"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

/** Crea el producto y su primera variante (con precio) en un solo paso. */
export async function createProductAction(formData: FormData) {
  await requireRole("admin");

  const companyId = String(formData.get("company_id") ?? "");
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const variantName = String(formData.get("variant_name") ?? "Único").trim() || "Único";
  const unitPrice = Number(formData.get("unit_price") ?? 0);

  if (!companyId || !sku || !name) {
    throw new Error("Empresa, clave y nombre son obligatorios.");
  }
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error("El precio unitario debe ser un número válido.");
  }

  const supabase = await createClient();

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({ company_id: companyId, sku, name, description })
    .select("id")
    .single();

  if (productError || !product) {
    throw new Error(productError?.message ?? "No se pudo crear el producto.");
  }

  const { error: variantError } = await supabase.from("product_variants").insert({
    product_id: product.id,
    name: variantName,
    unit_price: unitPrice,
  });

  if (variantError) throw new Error(variantError.message);

  revalidatePath("/admin/catalog/products");
  redirect(`/admin/catalog/products/${product.id}`);
}

export async function toggleProductActiveAction(formData: FormData) {
  await requireRole("admin");

  const productId = String(formData.get("product_id") ?? "");
  const nextActive = formData.get("active") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ active: nextActive })
    .eq("id", productId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/catalog/products");
}
