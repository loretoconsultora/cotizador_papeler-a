"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/require-user";
import { recomputeQuoteTotals } from "@/lib/quotes/recompute";

/** Paso 1 del asistente: guarda los datos del cliente y pasa al paso 2. */
export async function wizardSaveClientAction(formData: FormData) {
  const { supabase } = await requireProfile();
  const quoteId = String(formData.get("quote_id") ?? "");
  if (!quoteId) throw new Error("Falta la cotización.");

  const clientName = String(formData.get("client_name") ?? "").trim();
  const companyName = String(formData.get("company_name") ?? "").trim();
  if (!clientName || !companyName) {
    throw new Error("El nombre del cliente y la empresa son obligatorios.");
  }

  const promptPaymentEnabled = formData.get("prompt_payment_enabled") === "on";
  const promptPaymentPctRaw = formData.get("prompt_payment_pct");
  const promptPaymentPct = promptPaymentEnabled ? Number(promptPaymentPctRaw ?? 5) : 5;

  const { error } = await supabase
    .from("quotes")
    .update({
      client_name_snapshot: clientName,
      company_name_snapshot: companyName,
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
  revalidatePath(`/quotes/${quoteId}/new`);
  redirect(`/quotes/${quoteId}/new?step=2`);
}

/**
 * Paso 3 → confirmación final del pedido. A partir de aquí la cotización
 * deja de ser un borrador "en construcción" (aunque su status operativo
 * siga en 'draft' hasta que se apruebe más adelante, ver flujo de Aprobada).
 */
export async function confirmQuoteAction(formData: FormData) {
  const { supabase } = await requireProfile();
  const quoteId = String(formData.get("quote_id") ?? "");
  if (!quoteId) throw new Error("Falta la cotización.");

  const { data: items } = await supabase.from("quote_items").select("id").eq("quote_id", quoteId).limit(1);
  if (!items || items.length === 0) {
    throw new Error("Agrega al menos un producto antes de confirmar.");
  }

  const { error } = await supabase
    .from("quotes")
    .update({ confirmed_at: new Date().toISOString() })
    .eq("id", quoteId)
    .is("confirmed_at", null);
  if (error) throw new Error(error.message);

  revalidatePath(`/quotes/${quoteId}/new`);
  revalidatePath("/quotes");
  redirect(`/quotes/${quoteId}/new?step=4`);
}
