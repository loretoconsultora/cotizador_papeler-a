import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderClientQuotePdf } from "@/lib/pdf/render";

/**
 * Genera (o regenera) el PDF de la cotización cliente, lo sube al bucket
 * público client-quote-pdfs en una ruta fija por cotización (upsert, así
 * siempre queda la versión más reciente) y redirige a wa.me con el enlace
 * ya armado — el vendedor solo elige el contacto y manda.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  const { quoteId } = await params;
  const supabase = await createClient();

  const result = await renderClientQuotePdf(supabase, quoteId);
  if (!result) {
    return NextResponse.json({ error: "Cotización no encontrada." }, { status: 404 });
  }

  const path = `${quoteId}/cotizacion.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("client-quote-pdfs")
    .upload(path, result.buffer, { upsert: true, contentType: "application/pdf" });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: pub } = supabase.storage.from("client-quote-pdfs").getPublicUrl(path);
  const message = `Hola${result.clientName ? " " + result.clientName : ""}, te comparto tu cotización (folio ${result.folio}): ${pub.publicUrl}`;

  return NextResponse.redirect(`https://wa.me/?text=${encodeURIComponent(message)}`);
}
