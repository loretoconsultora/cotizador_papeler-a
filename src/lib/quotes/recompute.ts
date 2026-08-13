import type { SupabaseClient } from "@supabase/supabase-js";
import { computeQuoteTotals } from "./totals";

/**
 * Recalcula y persiste subtotal/descuento/IVA/total de una cotización a
 * partir de sus quote_items actuales. Se llama al final de cualquier acción
 * que pueda afectar el total: agregar/quitar/editar una línea, o cambiar
 * pronto pago / condición de compra en el encabezado.
 */
export async function recomputeQuoteTotals(supabase: SupabaseClient, quoteId: string) {
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("prompt_payment_enabled, prompt_payment_pct, purchase_condition, iva_pct")
    .eq("id", quoteId)
    .single();

  if (quoteError || !quote) throw new Error(quoteError?.message ?? "Cotización no encontrada.");

  const { data: items, error: itemsError } = await supabase
    .from("quote_items")
    .select("line_total")
    .eq("quote_id", quoteId);

  if (itemsError) throw new Error(itemsError.message);

  const totals = computeQuoteTotals(items ?? [], {
    promptPaymentEnabled: quote.prompt_payment_enabled,
    promptPaymentPct: Number(quote.prompt_payment_pct),
    purchaseCondition: quote.purchase_condition,
    ivaPct: Number(quote.iva_pct),
  });

  const { error: updateError } = await supabase
    .from("quotes")
    .update({
      subtotal: totals.subtotal,
      discount_total: totals.discountTotal,
      iva_total: totals.ivaTotal,
      grand_total: totals.grandTotal,
    })
    .eq("id", quoteId);

  if (updateError) throw new Error(updateError.message);

  return totals;
}
