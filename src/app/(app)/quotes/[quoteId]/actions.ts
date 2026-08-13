"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeLineTotals } from "@/lib/quotes/totals";
import { recomputeQuoteTotals } from "@/lib/quotes/recompute";

/** Guarda los datos del encabezado (cliente, condición, pago, descuentos). */
export async function updateQuoteHeaderAction(formData: FormData) {
  const quoteId = String(formData.get("quote_id") ?? "");
  if (!quoteId) throw new Error("Falta la cotización.");

  const supabase = await createClient();

  const promptPaymentEnabled = formData.get("prompt_payment_enabled") === "on";
  const promptPaymentPctRaw = formData.get("prompt_payment_pct");
  const promptPaymentPct = promptPaymentEnabled
    ? Number(promptPaymentPctRaw ?? 5)
    : 5;

  const { error } = await supabase
    .from("quotes")
    .update({
      client_name_snapshot: String(formData.get("client_name") ?? "").trim(),
      company_name_snapshot: String(formData.get("company_name") ?? "").trim(),
      phone_snapshot: String(formData.get("phone") ?? "").trim() || null,
      email_snapshot: String(formData.get("email") ?? "").trim() || null,
      address_snapshot: String(formData.get("address") ?? "").trim() || null,
      purchase_condition: String(formData.get("purchase_condition") ?? "credit"),
      payment_method: String(formData.get("payment_method") ?? "transfer"),
      prompt_payment_enabled: promptPaymentEnabled,
      prompt_payment_pct: promptPaymentPct,
      special_client_enabled: formData.get("special_client_enabled") === "on",
    })
    .eq("id", quoteId);

  if (error) throw new Error(error.message);

  await recomputeQuoteTotals(supabase, quoteId);
  revalidatePath(`/quotes/${quoteId}`);
}

/**
 * Agrega una línea. Los datos comerciales (precio, nombre, clave) se
 * re-obtienen del catálogo en el servidor — nunca se confía en lo que
 * llega del formulario para el precio, solo los IDs elegidos.
 */
export async function addItemAction(formData: FormData) {
  const quoteId = String(formData.get("quote_id") ?? "");
  const variantId = String(formData.get("variant_id") ?? "");
  const packageId = String(formData.get("package_id") ?? "") || null;
  const quantityInput = Number(formData.get("quantity") ?? 0);

  if (!quoteId || !variantId || !Number.isFinite(quantityInput) || quantityInput <= 0) {
    throw new Error("Selecciona un producto y una cantidad válida.");
  }

  const supabase = await createClient();

  const { data: variant, error: variantError } = await supabase
    .from("product_variants")
    .select("id, name, sku, description, unit_price, company_id, product_id, products(name)")
    .eq("id", variantId)
    .single();

  if (variantError || !variant) throw new Error("Variante no encontrada.");

  let unitsPerPackageSnapshot: number | null = null;
  let quantityPackages: number | null = null;
  let quantityUnits: number;

  if (packageId) {
    const { data: pkg, error: pkgError } = await supabase
      .from("product_packages")
      .select("units_per_package")
      .eq("id", packageId)
      .single();
    if (pkgError || !pkg) throw new Error("Paquete no encontrado.");

    unitsPerPackageSnapshot = pkg.units_per_package;
    quantityPackages = Math.round(quantityInput);
    quantityUnits = quantityPackages * pkg.units_per_package;
  } else {
    quantityUnits = Math.round(quantityInput);
  }

  const { lineSubtotal, discountAmount, lineTotal } = computeLineTotals(
    Number(variant.unit_price),
    quantityUnits,
    0
  );

  const productName = (variant.products as unknown as { name: string } | null)?.name ?? "";

  const { error: insertError } = await supabase.from("quote_items").insert({
    quote_id: quoteId,
    company_id: variant.company_id,
    product_id: variant.product_id,
    variant_id: variant.id,
    package_id: packageId,
    sku_snapshot: variant.sku ?? "",
    product_name_snapshot: productName,
    description_snapshot: variant.description,
    variant_name_snapshot: variant.name,
    unit_price_snapshot: variant.unit_price,
    units_per_package_snapshot: unitsPerPackageSnapshot,
    quantity_packages: quantityPackages,
    quantity_units: quantityUnits,
    line_subtotal: lineSubtotal,
    discount_pct: 0,
    discount_amount: discountAmount,
    line_total: lineTotal,
  });

  if (insertError) throw new Error(insertError.message);

  await recomputeQuoteTotals(supabase, quoteId);
  revalidatePath(`/quotes/${quoteId}`);
}

export async function removeItemAction(formData: FormData) {
  const quoteId = String(formData.get("quote_id") ?? "");
  const itemId = String(formData.get("item_id") ?? "");
  if (!quoteId || !itemId) throw new Error("Falta información.");

  const supabase = await createClient();
  const { error } = await supabase.from("quote_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);

  await recomputeQuoteTotals(supabase, quoteId);
  revalidatePath(`/quotes/${quoteId}`);
}

/** Descuento "cliente especial" — por línea, solo relevante si está activo en el encabezado. */
export async function updateItemDiscountAction(formData: FormData) {
  const quoteId = String(formData.get("quote_id") ?? "");
  const itemId = String(formData.get("item_id") ?? "");
  const discountPct = Number(formData.get("discount_pct") ?? 0);

  if (!quoteId || !itemId || !Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100) {
    throw new Error("Porcentaje de descuento inválido.");
  }

  const supabase = await createClient();

  const { data: item, error: itemError } = await supabase
    .from("quote_items")
    .select("unit_price_snapshot, quantity_units")
    .eq("id", itemId)
    .single();
  if (itemError || !item) throw new Error("Línea no encontrada.");

  const { lineSubtotal, discountAmount, lineTotal } = computeLineTotals(
    Number(item.unit_price_snapshot),
    item.quantity_units,
    discountPct
  );

  const { error: updateError } = await supabase
    .from("quote_items")
    .update({
      discount_pct: discountPct,
      line_subtotal: lineSubtotal,
      discount_amount: discountAmount,
      line_total: lineTotal,
    })
    .eq("id", itemId);
  if (updateError) throw new Error(updateError.message);

  await recomputeQuoteTotals(supabase, quoteId);
  revalidatePath(`/quotes/${quoteId}`);
}
