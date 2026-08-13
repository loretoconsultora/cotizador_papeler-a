import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderClientQuotePdf } from "@/lib/pdf/render";

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

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.folio}-cliente.pdf"`,
    },
  });
}
