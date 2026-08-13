import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { deliveryLabel, fetchQuoteForPdf } from "@/lib/pdf/data";
import { QuotePdf, type QuotePdfItem } from "@/lib/pdf/QuotePdf";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ quoteId: string; companyId: string }> }
) {
  const { quoteId, companyId } = await params;
  const supabase = await createClient();

  const result = await fetchQuoteForPdf(supabase, quoteId);
  if (!result) {
    return NextResponse.json({ error: "Cotización no encontrada." }, { status: 404 });
  }

  const { quote, items, companyById, paymentMethodLabel, purchaseConditionLabel } = result;
  const company = companyById.get(companyId);
  if (!company) {
    return NextResponse.json({ error: "Empresa no encontrada en esta cotización." }, { status: 404 });
  }

  const { data: providerQuote } = await supabase
    .from("provider_quotes")
    .select("folio")
    .eq("quote_id", quoteId)
    .eq("company_id", companyId)
    .single();

  const companyItems = items.filter((item) => item.company_id === companyId);
  if (companyItems.length === 0) {
    return NextResponse.json({ error: "No hay productos de esta empresa." }, { status: 404 });
  }

  const pdfItems: QuotePdfItem[] = companyItems.map((item) => ({
    companyShortCode: company.short_code,
    sku: item.sku_snapshot,
    productName: item.product_name_snapshot,
    variantName: item.variant_name_snapshot,
    quantityUnits: item.quantity_units,
    quantityPackages: item.quantity_packages,
    unitsPerPackage: item.units_per_package_snapshot,
    unitPrice: Number(item.unit_price_snapshot),
    lineTotal: Number(item.line_total),
  }));

  const providerSubtotal = companyItems.reduce((sum, item) => sum + Number(item.line_total), 0);
  const folio = providerQuote?.folio ?? `${quote.folio}-${company.short_code}`;

  const buffer = await renderToBuffer(
    <QuotePdf
      audience="provider"
      folio={folio}
      createdAt={quote.created_at}
      clientName={quote.client_name_snapshot}
      companyName={quote.company_name_snapshot}
      phone={quote.phone_snapshot}
      email={quote.email_snapshot}
      address={quote.address_snapshot}
      paymentMethodLabel={paymentMethodLabel}
      purchaseConditionLabel={purchaseConditionLabel}
      showCashNotice={quote.payment_method === "cash"}
      items={pdfItems}
      providerCompanyName={company.name}
      rfc={quote.rfc_snapshot}
      taxRegime={quote.tax_regime_snapshot}
      cfdiUse={quote.cfdi_use_snapshot}
      carrierName={quote.carrier_name}
      deliveryLabel={deliveryLabel(quote.delivery_type, quote.delivery_address)}
      providerSubtotal={providerSubtotal}
    />
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${folio}.pdf"`,
    },
  });
}
