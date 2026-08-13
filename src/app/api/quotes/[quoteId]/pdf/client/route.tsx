import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { fetchQuoteForPdf } from "@/lib/pdf/data";
import { QuotePdf, type QuotePdfItem } from "@/lib/pdf/QuotePdf";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  const { quoteId } = await params;
  const supabase = await createClient();

  const result = await fetchQuoteForPdf(supabase, quoteId);
  if (!result) {
    return NextResponse.json({ error: "Cotización no encontrada." }, { status: 404 });
  }

  const { quote, items, companyById, paymentMethodLabel, purchaseConditionLabel } = result;

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
      clientTotals={{
        subtotal: Number(quote.subtotal),
        discountTotal: Number(quote.discount_total),
        ivaPct: Number(quote.iva_pct),
        ivaTotal: Number(quote.iva_total),
        grandTotal: Number(quote.grand_total),
      }}
    />
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${quote.folio}-cliente.pdf"`,
    },
  });
}
