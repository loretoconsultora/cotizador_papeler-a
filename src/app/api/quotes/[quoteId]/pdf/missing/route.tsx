import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { MissingItemsPdf, type MissingItem } from "@/lib/pdf/MissingItemsPdf";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  const { quoteId } = await params;
  const supabase = await createClient();

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, folio, client_name_snapshot, company_name_snapshot, status")
    .eq("id", quoteId)
    .single();
  if (quoteError || !quote) {
    return NextResponse.json({ error: "Cotización no encontrada." }, { status: 404 });
  }

  const { data: items } = await supabase
    .from("quote_items")
    .select(
      "id, sku_snapshot, product_name_snapshot, variant_name_snapshot, quantity_units, quantity_packages, units_per_package_snapshot"
    )
    .eq("quote_id", quoteId);

  const { data: fulfillment } = await supabase
    .from("quote_item_fulfillment")
    .select("quote_item_id, received")
    .in("quote_item_id", (items ?? []).map((i) => i.id));

  const missingIds = new Set(
    (fulfillment ?? []).filter((f) => f.received === false).map((f) => f.quote_item_id)
  );
  const missingItems: MissingItem[] = (items ?? [])
    .filter((i) => missingIds.has(i.id))
    .map((i) => ({
      sku: i.sku_snapshot,
      productName: i.product_name_snapshot,
      variantName: i.variant_name_snapshot,
      quantityUnits: i.quantity_units,
      quantityPackages: i.quantity_packages,
      unitsPerPackage: i.units_per_package_snapshot,
    }));

  if (missingItems.length === 0) {
    return NextResponse.json({ error: "No hay productos faltantes." }, { status: 404 });
  }

  const buffer = await renderToBuffer(
    <MissingItemsPdf
      folio={quote.folio}
      clientName={quote.client_name_snapshot}
      companyName={quote.company_name_snapshot}
      items={missingItems}
    />
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${quote.folio}-faltantes.pdf"`,
    },
  });
}
