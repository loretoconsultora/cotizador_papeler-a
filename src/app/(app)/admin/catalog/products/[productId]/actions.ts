"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function addVariantAction(formData: FormData) {
  await requireRole("admin");

  const productId = String(formData.get("product_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const unitPrice = Number(formData.get("unit_price") ?? 0);

  if (!productId || !name) throw new Error("Falta el nombre de la variante.");
  if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("Precio inválido.");

  const supabase = await createClient();
  const { error } = await supabase.from("product_variants").insert({
    product_id: productId,
    name,
    unit_price: unitPrice,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/catalog/products/${productId}`);
}

export async function toggleVariantActiveAction(formData: FormData) {
  await requireRole("admin");

  const variantId = String(formData.get("variant_id") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  const nextActive = formData.get("active") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_variants")
    .update({ active: nextActive })
    .eq("id", variantId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/catalog/products/${productId}`);
}

export async function addPackageAction(formData: FormData) {
  await requireRole("admin");

  const variantId = String(formData.get("variant_id") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  const unitsPerPackage = Number(formData.get("units_per_package") ?? 0);
  const label = String(formData.get("label") ?? "").trim() || null;

  if (!variantId || !Number.isInteger(unitsPerPackage) || unitsPerPackage <= 0) {
    throw new Error("Indica un número de piezas por paquete válido.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("product_packages").insert({
    variant_id: variantId,
    units_per_package: unitsPerPackage,
    label,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/catalog/products/${productId}`);
}

export async function togglePackageActiveAction(formData: FormData) {
  await requireRole("admin");

  const packageId = String(formData.get("package_id") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  const nextActive = formData.get("active") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_packages")
    .update({ active: nextActive })
    .eq("id", packageId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/catalog/products/${productId}`);
}
