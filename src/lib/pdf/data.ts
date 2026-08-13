import type { SupabaseClient } from "@supabase/supabase-js";

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  transfer: "Transferencia",
  deposit: "Depósito bancario",
  cash: "Efectivo (contra entrega en oficinas CDMX)",
};

const PURCHASE_CONDITION_LABEL: Record<string, string> = {
  credit: "A crédito",
  prepaid: "Pago anticipado",
};

export async function fetchQuoteForPdf(supabase: SupabaseClient, quoteId: string) {
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select(
      "id, folio, status, seller_id, client_name_snapshot, company_name_snapshot, phone_snapshot, email_snapshot, address_snapshot, purchase_condition, payment_method, subtotal, discount_total, iva_pct, iva_total, grand_total, rfc_snapshot, tax_regime_snapshot, cfdi_use_snapshot, carrier_name, delivery_type, delivery_address, created_at"
    )
    .eq("id", quoteId)
    .single();

  if (quoteError || !quote) return null;

  const { data: seller } = await supabase
    .from("profiles")
    .select("full_name, phone, contact_email")
    .eq("id", quote.seller_id)
    .single();

  const { data: itemsData } = await supabase
    .from("quote_items")
    .select(
      "id, company_id, sku_snapshot, product_name_snapshot, variant_name_snapshot, unit_price_snapshot, quantity_packages, units_per_package_snapshot, quantity_units, line_total"
    )
    .eq("quote_id", quoteId)
    .order("sort_order")
    .order("created_at");

  const { data: companiesData } = await supabase.from("companies").select("id, name, short_code");
  const companyById = new Map(
    (companiesData ?? []).map((c: { id: string; name: string; short_code: string }) => [c.id, c])
  );

  return {
    quote,
    items: itemsData ?? [],
    companyById,
    seller: seller ?? null,
    paymentMethodLabel: PAYMENT_METHOD_LABEL[quote.payment_method] ?? quote.payment_method,
    purchaseConditionLabel:
      PURCHASE_CONDITION_LABEL[quote.purchase_condition] ?? quote.purchase_condition,
  };
}

export function deliveryLabel(
  deliveryType: string | null,
  deliveryAddress: string | null
): string | null {
  if (deliveryType === "pickup") {
    return "Ocurre (recolecta en oficinas de la transportista)";
  }
  if (deliveryType === "address") {
    return `A domicilio — ${deliveryAddress ?? ""}`;
  }
  return null;
}
