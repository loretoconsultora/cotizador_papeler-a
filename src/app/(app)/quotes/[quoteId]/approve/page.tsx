import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TransportFields } from "@/components/quotes/transport-fields";
import { approveQuoteAction } from "./actions";

const TAX_REGIMES = [
  "601 General de Ley Personas Morales",
  "603 Personas Morales con Fines no Lucrativos",
  "605 Sueldos y Salarios e Ingresos Asimilados a Salarios",
  "606 Arrendamiento",
  "608 Demás ingresos",
  "610 Residentes en el Extranjero sin Establecimiento Permanente en México",
  "611 Ingresos por Dividendos (socios y accionistas)",
  "612 Personas Físicas con Actividades Empresariales y Profesionales",
  "614 Ingresos por intereses",
  "616 Sin obligaciones fiscales",
  "621 Incorporación Fiscal",
  "625 Régimen de Plataformas Tecnológicas",
  "626 Régimen Simplificado de Confianza",
];

const CFDI_USES = [
  "G01 Adquisición de mercancías",
  "G02 Devoluciones, descuentos o bonificaciones",
  "G03 Gastos en general",
  "I01 Construcciones",
  "I08 Otra maquinaria y equipo",
  "P01 Por definir",
  "S01 Sin efectos fiscales",
  "CP01 Pagos",
];

type ClientMatch = {
  id: string;
  client_name: string;
  company_name: string;
  rfc: string | null;
  tax_regime: string | null;
  cfdi_use: string | null;
  has_active_backorder: boolean;
  backorder_note: string | null;
  backorder_opened_at: string | null;
};

export default async function ApproveQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ quoteId: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { quoteId } = await params;
  const { new: forceNew } = await searchParams;
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select(
      "id, folio, status, client_name_snapshot, company_name_snapshot, address_snapshot, email_snapshot"
    )
    .eq("id", quoteId)
    .single();

  if (!quote) notFound();
  if (quote.status !== "draft") redirect(`/quotes/${quoteId}`);

  let existingClient: ClientMatch | null = null;

  if (forceNew !== "1") {
    const [byEmail, byCompany] = await Promise.all([
      quote.email_snapshot
        ? supabase.from("clients").select("*").ilike("email", quote.email_snapshot)
        : Promise.resolve({ data: [] as ClientMatch[] }),
      supabase.from("clients").select("*").ilike("company_name", quote.company_name_snapshot),
    ]);
    existingClient = (byEmail.data?.[0] ?? byCompany.data?.[0] ?? null) as ClientMatch | null;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs text-[var(--ink-muted)]">{quote.folio}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Aprobar cotización — {quote.client_name_snapshot}
        </h1>
        <p className="text-sm text-[var(--ink-muted)]">
          El cliente aceptó. Completa sus datos fiscales y de transporte para
          poder generar la cotización final.
        </p>
      </div>

      {existingClient && (
        <GlassCard className="space-y-2 border-brand-blue/20">
          <div className="flex items-center gap-2">
            <Badge tone="blue">Cliente existente</Badge>
            <span className="text-sm font-medium">{existingClient.company_name}</span>
          </div>
          <p className="text-sm text-[var(--ink-muted)]">
            Ya tenemos datos fiscales guardados de este cliente — los precargamos
            abajo, revísalos y ajusta lo que haya cambiado.
          </p>
          {existingClient.has_active_backorder && (
            <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800">
              ⚠️ Este cliente tiene un <strong>back order activo</strong>
              {existingClient.backorder_note ? `: ${existingClient.backorder_note}` : "."}
            </p>
          )}
          <Link
            href={`/quotes/${quoteId}/approve?new=1`}
            className="text-xs text-brand-blue underline"
          >
            No, es un cliente diferente — capturar datos nuevos
          </Link>
        </GlassCard>
      )}

      <form action={approveQuoteAction} className="space-y-6">
        <input type="hidden" name="quote_id" value={quote.id} />
        {existingClient && (
          <input type="hidden" name="existing_client_id" value={existingClient.id} />
        )}

        <GlassCard strong>
          <h2 className="mb-4 text-sm font-medium">Datos fiscales</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">RFC</label>
              <Input
                name="rfc"
                required
                defaultValue={existingClient?.rfc ?? ""}
                className="uppercase"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Régimen fiscal</label>
              <Input
                name="tax_regime"
                required
                list="tax-regimes"
                defaultValue={existingClient?.tax_regime ?? ""}
              />
              <datalist id="tax-regimes">
                {TAX_REGIMES.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-sm font-medium">Uso de CFDI</label>
              <Input
                name="cfdi_use"
                required
                list="cfdi-uses"
                defaultValue={existingClient?.cfdi_use ?? ""}
              />
              <datalist id="cfdi-uses">
                {CFDI_USES.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-sm font-medium">
                Constancia de situación fiscal (opcional)
              </label>
              <input
                type="file"
                name="fiscal_doc"
                accept=".pdf,.png,.jpg,.jpeg"
                className="w-full rounded-xl border border-black/10 bg-white/70 px-3.5 py-2.5 text-sm dark:border-white/10 dark:bg-white/5"
              />
            </div>
          </div>
        </GlassCard>

        <GlassCard strong>
          <h2 className="mb-4 text-sm font-medium">Transporte</h2>
          <p className="mb-3 text-xs text-[var(--ink-muted)]">
            Esta información es solo para las cotizaciones a los proveedores —
            no aparece en la cotización del cliente.
          </p>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Empresa transportista</label>
              <Input name="carrier_name" required />
            </div>
            <TransportFields clientAddress={quote.address_snapshot} />
          </div>
        </GlassCard>

        <Button type="submit">Confirmar y marcar como Aprobada</Button>
      </form>
    </div>
  );
}
