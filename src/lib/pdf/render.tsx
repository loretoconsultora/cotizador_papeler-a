import type { SupabaseClient } from "@supabase/supabase-js";
import { renderToBuffer } from "@react-pdf/renderer";
import { fetchQuoteForPdf } from "./data";
import { QuotePdf, type QuotePdfItem } from "./QuotePdf";

/**
 * Arma y renderiza el PDF de "cotización cliente" (sin datos fiscales ni de
 * transporte). Compartido entre la descarga directa y el enlace de
 * WhatsApp — ambos necesitan exactamente el mismo documento.
 */
export async function renderClientQuotePdf(supabase: SupabaseClient, quoteId: string) {
  const result = await fetchQuoteForPdf(supabase, quoteId);
  if (!result) return null;

  const { quote, items, companyById, seller, paymentMethodLabel, purchaseConditionLabel } = result;

  const pdfItems: QuotePdfItem[] = items.map((item) => ({
    companyShortCode: companyById.get(item.company_id)?.short_code ?? "",
    sku: item.sku_snapshot,
    productName: item.product_name_snapshot,
    variantName: item.variant_name_snapshot,
    quantityUnits: item.quantity_units,
    quantityPackages: item.quantity_packages,
    unitsPerPackage: item.units_per_package_snapshot,
    unitPrice: Number(item.unit_price_snapshot),
    lineTotal: Number(item.line_total),
  }));

  const buffer = await renderToBuffer(
    <QuotePdf
      audience="client"
      folio={quote.folio}
      createdAt={quote.created_at}
      clientName={quote.client_name_snapshot}
      companyName={quote.company_name_snapshot}
      paymentMethodLabel={paymentMethodLabel}
      purchaseConditionLabel={purchaseConditionLabel}
      showCashNotice={quote.payment_method === "cash"}
      items={pdfItems}
      sellerName={seller?.full_name}
      sellerPhone={seller?.phone}
      sellerEmail={seller?.contact_email}
      clientTotals={{
        subtotal: Number(quote.subtotal),
        discountTotal: Number(quote.discount_total),
        ivaPct: Number(quote.iva_pct),
        ivaTotal: Number(quote.iva_total),
        grandTotal: Number(quote.grand_total),
      }}
    />
  );

  return { buffer, folio: quote.folio, clientName: quote.client_name_snapshot };
}
