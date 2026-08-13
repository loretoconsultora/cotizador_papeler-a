"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/require-user";
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
  revalidatePath(`/quotes/${quoteId}/new`);
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
  revalidatePath(`/quotes/${quoteId}/new`);
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
  revalidatePath(`/quotes/${quoteId}/new`);
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

/**
 * Cambia la cantidad de una línea ya agregada (paquetes o unidades sueltas,
 * según cómo se haya agregado originalmente) sin tener que quitarla y
 * volver a capturarla. Reutilizada por el editor completo y por el paso 3
 * del asistente de creación.
 */
export async function updateItemQuantityAction(formData: FormData) {
  const quoteId = String(formData.get("quote_id") ?? "");
  const itemId = String(formData.get("item_id") ?? "");
  const quantityInput = Number(formData.get("quantity") ?? 0);

  if (!quoteId || !itemId || !Number.isFinite(quantityInput) || quantityInput <= 0) {
    throw new Error("Cantidad inválida.");
  }

  const supabase = await createClient();

  const { data: item, error: itemError } = await supabase
    .from("quote_items")
    .select("unit_price_snapshot, units_per_package_snapshot, package_id, discount_pct")
    .eq("id", itemId)
    .single();
  if (itemError || !item) throw new Error("Línea no encontrada.");

  const quantityPackages = item.package_id ? Math.round(quantityInput) : null;
  const quantityUnits = item.package_id
    ? quantityPackages! * (item.units_per_package_snapshot ?? 1)
    : Math.round(quantityInput);

  const { lineSubtotal, discountAmount, lineTotal } = computeLineTotals(
    Number(item.unit_price_snapshot),
    quantityUnits,
    item.discount_pct
  );

  const { error: updateError } = await supabase
    .from("quote_items")
    .update({
      quantity_packages: quantityPackages,
      quantity_units: quantityUnits,
      line_subtotal: lineSubtotal,
      discount_amount: discountAmount,
      line_total: lineTotal,
    })
    .eq("id", itemId);
  if (updateError) throw new Error(updateError.message);

  await recomputeQuoteTotals(supabase, quoteId);
  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath(`/quotes/${quoteId}/new`);
}

/**
 * Genera una cotización de proveedor por cada empresa presente en los
 * productos de la cotización, y pasa el estatus a 'final'. No duplica
 * quote_items — cada provider_quote es solo folio + referencia; el
 * contenido siempre se deriva filtrando quote_items por company_id, así
 * nunca se desincroniza si luego se edita una línea.
 */
export async function generateFinalQuoteAction(formData: FormData) {
  const { supabase, user } = await requireProfile();
  const quoteId = String(formData.get("quote_id") ?? "");
  if (!quoteId) throw new Error("Falta la cotización.");

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, folio, status")
    .eq("id", quoteId)
    .single();
  if (quoteError || !quote) throw new Error("Cotización no encontrada.");
  if (quote.status !== "approved") {
    throw new Error("La cotización debe estar Aprobada antes de generar la final.");
  }

  const { data: items, error: itemsError } = await supabase
    .from("quote_items")
    .select("company_id, companies(short_code)")
    .eq("quote_id", quoteId);
  if (itemsError) throw new Error(itemsError.message);
  if (!items || items.length === 0) {
    throw new Error("La cotización no tiene productos.");
  }

  type ItemCompany = { company_id: string; companies: { short_code: string } | null };
  const companies = new Map<string, string>();
  (items as unknown as ItemCompany[]).forEach((item) => {
    companies.set(item.company_id, item.companies?.short_code ?? "PROV");
  });

  const providerQuoteRows = Array.from(companies.entries()).map(([companyId, shortCode]) => ({
    quote_id: quoteId,
    company_id: companyId,
    folio: `${quote.folio}-${shortCode}`,
  }));

  const { error: insertError } = await supabase
    .from("provider_quotes")
    .upsert(providerQuoteRows, { onConflict: "quote_id,company_id", ignoreDuplicates: true });
  if (insertError) throw new Error(insertError.message);

  const { error: updateError } = await supabase
    .from("quotes")
    .update({ status: "final", final_at: new Date().toISOString() })
    .eq("id", quoteId);
  if (updateError) throw new Error(updateError.message);

  await supabase.from("quote_status_history").insert({
    quote_id: quoteId,
    from_status: "approved",
    to_status: "final",
    changed_by: user.id,
  });

  revalidatePath(`/quotes/${quoteId}`);
}

/**
 * Adjunta la factura que mandó un proveedor (copia por correo). La primera
 * factura que llega mueve la cotización de 'final' a 'invoiced' — las
 * siguientes (de otros proveedores) solo se agregan, sin repetir la
 * transición.
 */
export async function attachInvoiceAction(formData: FormData) {
  const { supabase, user } = await requireProfile();
  const quoteId = String(formData.get("quote_id") ?? "");
  const companyId = String(formData.get("company_id") ?? "");
  const file = formData.get("invoice_file");

  if (!quoteId || !companyId) throw new Error("Falta información.");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Selecciona un archivo de factura.");
  }

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, status")
    .eq("id", quoteId)
    .single();
  if (quoteError || !quote) throw new Error("Cotización no encontrada.");
  if (quote.status !== "final" && quote.status !== "invoiced") {
    throw new Error("Solo se pueden adjuntar facturas en estatus Cotización final o Factura.");
  }

  const path = `${quoteId}/${companyId}-${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("invoices")
    .upload(path, file, { upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { error: attachError } = await supabase.from("quote_attachments").insert({
    quote_id: quoteId,
    kind: "invoice",
    company_id: companyId,
    file_path: path,
    file_name: file.name,
    uploaded_by: user.id,
  });
  if (attachError) throw new Error(attachError.message);

  if (quote.status === "final") {
    await supabase
      .from("quotes")
      .update({ status: "invoiced", invoiced_at: new Date().toISOString() })
      .eq("id", quoteId);
    await supabase.from("quote_status_history").insert({
      quote_id: quoteId,
      from_status: "final",
      to_status: "invoiced",
      changed_by: user.id,
    });
  }

  revalidatePath(`/quotes/${quoteId}`);
}

/**
 * Pasa a 'ordered' y crea el renglón de cotejo (✓/✗) para cada línea de la
 * cotización, listo para que el vendedor confirme qué sí llegó.
 */
export async function markOrderedAction(formData: FormData) {
  const { supabase, user } = await requireProfile();
  const quoteId = String(formData.get("quote_id") ?? "");
  if (!quoteId) throw new Error("Falta la cotización.");

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, status")
    .eq("id", quoteId)
    .single();
  if (quoteError || !quote) throw new Error("Cotización no encontrada.");
  if (quote.status !== "invoiced") {
    throw new Error("La cotización debe tener al menos una factura adjunta.");
  }

  const { data: items, error: itemsError } = await supabase
    .from("quote_items")
    .select("id")
    .eq("quote_id", quoteId);
  if (itemsError) throw new Error(itemsError.message);

  const fulfillmentRows = (items ?? []).map((i) => ({ quote_item_id: i.id }));
  if (fulfillmentRows.length > 0) {
    const { error: fulfillmentError } = await supabase
      .from("quote_item_fulfillment")
      .upsert(fulfillmentRows, { onConflict: "quote_item_id", ignoreDuplicates: true });
    if (fulfillmentError) throw new Error(fulfillmentError.message);
  }

  const { error: updateError } = await supabase
    .from("quotes")
    .update({ status: "ordered", ordered_at: new Date().toISOString() })
    .eq("id", quoteId);
  if (updateError) throw new Error(updateError.message);

  await supabase.from("quote_status_history").insert({
    quote_id: quoteId,
    from_status: "invoiced",
    to_status: "ordered",
    changed_by: user.id,
  });

  revalidatePath(`/quotes/${quoteId}`);
}

/** Marca una línea como recibida (✓), faltante (✗), o pendiente (sin marcar). */
export async function updateFulfillmentAction(formData: FormData) {
  const { supabase, user } = await requireProfile();
  const quoteId = String(formData.get("quote_id") ?? "");
  const quoteItemId = String(formData.get("quote_item_id") ?? "");
  const receivedRaw = String(formData.get("received") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!quoteId || !quoteItemId) throw new Error("Falta información.");

  const received = receivedRaw === "true" ? true : receivedRaw === "false" ? false : null;

  const { error } = await supabase
    .from("quote_item_fulfillment")
    .update({ received, note, checked_by: user.id, checked_at: new Date().toISOString() })
    .eq("quote_item_id", quoteItemId);
  if (error) throw new Error(error.message);

  revalidatePath(`/quotes/${quoteId}`);
}

/** Cierra el ciclo de la cotización una vez cotejada la recepción. */
export async function closeQuoteAction(formData: FormData) {
  const { supabase, user } = await requireProfile();
  const quoteId = String(formData.get("quote_id") ?? "");
  if (!quoteId) throw new Error("Falta la cotización.");

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, status")
    .eq("id", quoteId)
    .single();
  if (quoteError || !quote) throw new Error("Cotización no encontrada.");
  if (quote.status !== "ordered") throw new Error("Solo se puede cerrar desde el estatus Pedido.");

  const { error } = await supabase
    .from("quotes")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", quoteId);
  if (error) throw new Error(error.message);

  await supabase.from("quote_status_history").insert({
    quote_id: quoteId,
    from_status: "ordered",
    to_status: "closed",
    changed_by: user.id,
  });

  revalidatePath(`/quotes/${quoteId}`);
}

/** Activa el back order del cliente ligado a esta cotización. */
export async function setBackorderAction(formData: FormData) {
  const { supabase } = await requireProfile();
  const quoteId = String(formData.get("quote_id") ?? "");
  const note = String(formData.get("backorder_note") ?? "").trim() || null;
  if (!quoteId) throw new Error("Falta la cotización.");

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("client_id")
    .eq("id", quoteId)
    .single();
  if (quoteError || !quote?.client_id) throw new Error("Esta cotización no tiene cliente asociado.");

  const { error } = await supabase
    .from("clients")
    .update({
      has_active_backorder: true,
      backorder_note: note,
      backorder_opened_at: new Date().toISOString(),
      backorder_closed_at: null,
    })
    .eq("id", quote.client_id);
  if (error) throw new Error(error.message);

  revalidatePath(`/quotes/${quoteId}`);
}

/** Descarta/cierra el back order del cliente ligado a esta cotización. */
export async function closeBackorderAction(formData: FormData) {
  const { supabase } = await requireProfile();
  const quoteId = String(formData.get("quote_id") ?? "");
  if (!quoteId) throw new Error("Falta la cotización.");

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("client_id")
    .eq("id", quoteId)
    .single();
  if (quoteError || !quote?.client_id) throw new Error("Esta cotización no tiene cliente asociado.");

  const { error } = await supabase
    .from("clients")
    .update({ has_active_backorder: false, backorder_closed_at: new Date().toISOString() })
    .eq("id", quote.client_id);
  if (error) throw new Error(error.message);

  revalidatePath(`/quotes/${quoteId}`);
}

/**
 * Cambia el resultado comercial (Ganada / En seguimiento / Perdida).
 * Independiente del estatus operativo — una cotización se puede perder en
 * cualquier punto del flujo, no solo al final.
 */
export async function updateOutcomeAction(formData: FormData) {
  const { supabase } = await requireProfile();
  const quoteId = String(formData.get("quote_id") ?? "");
  const outcome = String(formData.get("outcome") ?? "in_progress");
  const lostReason = String(formData.get("lost_reason") ?? "").trim() || null;
  if (!quoteId) throw new Error("Falta la cotización.");

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    outcome,
    lost_reason: outcome === "lost" ? lostReason : null,
  };
  if (outcome === "won") patch.won_at = now;
  if (outcome === "lost") patch.lost_at = now;

  const { error } = await supabase.from("quotes").update(patch).eq("id", quoteId);
  if (error) throw new Error(error.message);

  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/quotes");
  revalidatePath("/dashboard");
}
