import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductPicker } from "@/components/quotes/product-picker";
import { ClientDataFields } from "@/components/quotes/client-data-fields";
import {
  attachInvoiceAction,
  closeBackorderAction,
  closeQuoteAction,
  generateFinalQuoteAction,
  markOrderedAction,
  removeItemAction,
  setBackorderAction,
  updateFulfillmentAction,
  updateItemDiscountAction,
  updateItemQuantityAction,
  updateOutcomeAction,
  updateQuoteHeaderAction,
} from "./actions";

type Quote = {
  id: string;
  folio: string;
  status: string;
  outcome: string;
  lost_reason: string | null;
  client_id: string | null;
  client_name_snapshot: string;
  company_name_snapshot: string;
  phone_snapshot: string | null;
  email_snapshot: string | null;
  address_snapshot: string | null;
  purchase_condition: "credit" | "prepaid";
  payment_method: "transfer" | "deposit" | "cash";
  prompt_payment_enabled: boolean;
  prompt_payment_pct: number;
  special_client_enabled: boolean;
  rfc_snapshot: string | null;
  tax_regime_snapshot: string | null;
  cfdi_use_snapshot: string | null;
  carrier_name: string | null;
  delivery_type: "address" | "pickup" | null;
  delivery_address: string | null;
  subtotal: number;
  discount_total: number;
  iva_total: number;
  iva_pct: number;
  grand_total: number;
};

type QuoteItem = {
  id: string;
  company_id: string;
  sku_snapshot: string;
  product_name_snapshot: string;
  variant_name_snapshot: string;
  unit_price_snapshot: number;
  quantity_packages: number | null;
  units_per_package_snapshot: number | null;
  quantity_units: number;
  discount_pct: number;
  line_total: number;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  approved: "Aprobada",
  final: "Cotización final",
  invoiced: "Factura",
  ordered: "Pedido",
  closed: "Cerrada",
};

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const { quoteId } = await params;
  const supabase = await createClient();

  const { data: quoteData } = await supabase
    .from("quotes")
    .select(
      "id, folio, status, outcome, lost_reason, client_id, client_name_snapshot, company_name_snapshot, phone_snapshot, email_snapshot, address_snapshot, purchase_condition, payment_method, prompt_payment_enabled, prompt_payment_pct, special_client_enabled, rfc_snapshot, tax_regime_snapshot, cfdi_use_snapshot, carrier_name, delivery_type, delivery_address, subtotal, discount_total, iva_total, iva_pct, grand_total"
    )
    .eq("id", quoteId)
    .single();

  if (!quoteData) notFound();
  const quote = quoteData as Quote;
  const editable = quote.status !== "closed";

  let fiscalDocUrl: string | null = null;
  let clientBackorder: {
    has_active_backorder: boolean;
    backorder_note: string | null;
  } | null = null;
  if (quote.client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("fiscal_doc_path, has_active_backorder, backorder_note")
      .eq("id", quote.client_id)
      .single();
    if (client?.fiscal_doc_path) {
      const { data: signed } = await supabase.storage
        .from("fiscal-docs")
        .createSignedUrl(client.fiscal_doc_path, 60 * 10);
      fiscalDocUrl = signed?.signedUrl ?? null;
    }
    if (client) {
      clientBackorder = {
        has_active_backorder: client.has_active_backorder,
        backorder_note: client.backorder_note,
      };
    }
  }

  const [
    { data: itemsData },
    { data: companiesData },
    { data: productsData },
    { data: providerQuotesData },
    { data: invoicesData },
    { data: fulfillmentData },
  ] = await Promise.all([
    supabase
      .from("quote_items")
      .select(
        "id, company_id, sku_snapshot, product_name_snapshot, variant_name_snapshot, unit_price_snapshot, quantity_packages, units_per_package_snapshot, quantity_units, discount_pct, line_total"
      )
      .eq("quote_id", quoteId)
      .order("sort_order")
      .order("created_at"),
    supabase.from("companies").select("id, name, short_code"),
    supabase
      .from("products")
      .select(
        "id, name, company_id, companies(name), product_variants(id, name, sku, unit_price, active, product_packages(id, units_per_package, label, active))"
      )
      .eq("active", true)
      .order("name"),
    supabase
      .from("provider_quotes")
      .select("id, company_id, folio, generated_at")
      .eq("quote_id", quoteId),
    supabase
      .from("quote_attachments")
      .select("id, company_id, file_path, file_name")
      .eq("quote_id", quoteId)
      .eq("kind", "invoice"),
    supabase
      .from("quote_item_fulfillment")
      .select("quote_item_id, received, note")
      .in(
        "quote_item_id",
        (
          await supabase.from("quote_items").select("id").eq("quote_id", quoteId)
        ).data?.map((i) => i.id) ?? []
      ),
  ]);

  const items = (itemsData ?? []) as QuoteItem[];
  const companies = (companiesData ?? []) as { id: string; name: string; short_code: string }[];
  const companyShortCode = new Map(companies.map((c) => [c.id, c.short_code]));
  const companyName = new Map(companies.map((c) => [c.id, c.name]));

  type Invoice = { id: string; company_id: string | null; file_path: string; file_name: string };
  const invoices = (invoicesData ?? []) as Invoice[];
  const invoicesByCompany = new Map<string, Invoice[]>();
  invoices.forEach((inv) => {
    if (!inv.company_id) return;
    invoicesByCompany.set(inv.company_id, [...(invoicesByCompany.get(inv.company_id) ?? []), inv]);
  });
  const invoiceUrls = new Map<string, string>();
  for (const inv of invoices) {
    const { data: signed } = await supabase.storage
      .from("invoices")
      .createSignedUrl(inv.file_path, 60 * 10);
    if (signed?.signedUrl) invoiceUrls.set(inv.id, signed.signedUrl);
  }

  type Fulfillment = { quote_item_id: string; received: boolean | null; note: string | null };
  const fulfillmentByItem = new Map<string, Fulfillment>(
    ((fulfillmentData ?? []) as Fulfillment[]).map((f) => [f.quote_item_id, f])
  );
  const missingItems = items.filter((i) => fulfillmentByItem.get(i.id)?.received === false);

  type ProviderQuote = { id: string; company_id: string; folio: string; generated_at: string };
  const providerQuotes = (providerQuotesData ?? []) as ProviderQuote[];
  const providerQuoteSummaries = providerQuotes.map((pq) => {
    const companyItems = items.filter((i) => i.company_id === pq.company_id);
    return {
      ...pq,
      itemCount: companyItems.length,
      subtotal: companyItems.reduce((sum, i) => sum + Number(i.line_total), 0),
      invoices: invoicesByCompany.get(pq.company_id) ?? [],
    };
  });

  type RawVariant = {
    id: string;
    name: string;
    sku: string | null;
    unit_price: number;
    active: boolean;
    product_packages: { id: string; units_per_package: number; label: string | null; active: boolean }[];
  };
  type RawProduct = {
    id: string;
    name: string;
    company_id: string;
    companies: { name: string } | null;
    product_variants: RawVariant[];
  };

  const pickerProducts = ((productsData ?? []) as unknown as RawProduct[])
    .map((p) => ({
      id: p.id,
      name: p.name,
      company_id: p.company_id,
      company_name: p.companies?.name ?? "",
      variants: (p.product_variants ?? [])
        .filter((v) => v.active)
        .map((v) => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          unit_price: Number(v.unit_price),
          packages: (v.product_packages ?? [])
            .filter((pk) => pk.active)
            .map((pk) => ({ id: pk.id, units_per_package: pk.units_per_package, label: pk.label })),
        })),
    }))
    .filter((p) => p.variants.length > 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--ink-muted)]">{quote.folio}</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {quote.client_name_snapshot || "Cotización nueva"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="blue">{STATUS_LABEL[quote.status] ?? quote.status}</Badge>
          {items.length > 0 && (
            <a href={`/api/quotes/${quote.id}/pdf/client`} target="_blank" rel="noreferrer">
              <Button variant="secondary" className="px-4 py-2 text-sm">
                Descargar cotización cliente
              </Button>
            </a>
          )}
          {quote.status === "draft" && (
            <Link href={`/quotes/${quote.id}/approve`}>
              <Button variant="primary" className="px-4 py-2 text-sm">
                Marcar como Aprobada
              </Button>
            </Link>
          )}
          {quote.status === "approved" && (
            <form action={generateFinalQuoteAction}>
              <input type="hidden" name="quote_id" value={quote.id} />
              <Button type="submit" className="px-4 py-2 text-sm">
                Generar cotización final
              </Button>
            </form>
          )}
          {quote.status === "invoiced" && (
            <form action={markOrderedAction}>
              <input type="hidden" name="quote_id" value={quote.id} />
              <Button type="submit" className="px-4 py-2 text-sm">
                Marcar como Pedido
              </Button>
            </form>
          )}
          {quote.status === "ordered" && (
            <form action={closeQuoteAction}>
              <input type="hidden" name="quote_id" value={quote.id} />
              <Button type="submit" variant="secondary" className="px-4 py-2 text-sm">
                Cerrar cotización
              </Button>
            </form>
          )}
        </div>
      </div>

      <GlassCard className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-[var(--ink-muted)]">Resultado:</span>
        <form action={updateOutcomeAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="quote_id" value={quote.id} />
          <select
            name="outcome"
            defaultValue={quote.outcome}
            className="rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-white/10 dark:bg-white/5"
          >
            <option value="in_progress">En seguimiento</option>
            <option value="won">Ganada</option>
            <option value="lost">Perdida</option>
          </select>
          <Input
            name="lost_reason"
            placeholder="Motivo (si se perdió)"
            defaultValue={quote.lost_reason ?? ""}
            className="w-56"
          />
          <Button type="submit" variant="secondary" className="px-3 py-2 text-sm">
            Guardar
          </Button>
        </form>
      </GlassCard>

      {quote.status !== "draft" && (
        <GlassCard>
          <h2 className="mb-3 text-sm font-medium text-[var(--ink-muted)]">
            Datos fiscales y transporte
          </h2>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="text-[var(--ink-muted)]">RFC:</span> {quote.rfc_snapshot}
            </p>
            <p>
              <span className="text-[var(--ink-muted)]">Régimen fiscal:</span>{" "}
              {quote.tax_regime_snapshot}
            </p>
            <p className="sm:col-span-2">
              <span className="text-[var(--ink-muted)]">Uso de CFDI:</span>{" "}
              {quote.cfdi_use_snapshot}
            </p>
            <p>
              <span className="text-[var(--ink-muted)]">Transportista:</span>{" "}
              {quote.carrier_name}
            </p>
            <p>
              <span className="text-[var(--ink-muted)]">Entrega:</span>{" "}
              {quote.delivery_type === "pickup"
                ? "Ocurre (recolecta en oficinas de la transportista)"
                : `A domicilio — ${quote.delivery_address}`}
            </p>
            {fiscalDocUrl && (
              <a
                href={fiscalDocUrl}
                target="_blank"
                rel="noreferrer"
                className="text-brand-blue underline sm:col-span-2"
              >
                Ver constancia de situación fiscal
              </a>
            )}
          </div>
        </GlassCard>
      )}

      {providerQuoteSummaries.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-[var(--ink-muted)]">
            Cotizaciones por proveedor
          </h2>
          {providerQuoteSummaries.map((pq) => (
            <GlassCard key={pq.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-medium">
                    <Badge tone="blue">{companyShortCode.get(pq.company_id) ?? "?"}</Badge>
                    {companyName.get(pq.company_id) ?? "Proveedor"}
                  </p>
                  <p className="text-xs text-[var(--ink-muted)]">
                    {pq.folio} · {pq.itemCount} producto(s) · $
                    {pq.subtotal.toFixed(2)}
                  </p>
                </div>
                <a
                  href={`/api/quotes/${quote.id}/pdf/provider/${pq.company_id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="secondary" className="px-3 py-1.5 text-xs">
                    Descargar PDF
                  </Button>
                </a>
              </div>

              {pq.invoices.length > 0 && (
                <div className="flex flex-wrap gap-2 border-t border-black/5 pt-2 dark:border-white/10">
                  {pq.invoices.map((inv) => (
                    <a
                      key={inv.id}
                      href={invoiceUrls.get(inv.id) ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-brand-blue underline"
                    >
                      📄 {inv.file_name}
                    </a>
                  ))}
                </div>
              )}

              {(quote.status === "final" || quote.status === "invoiced") && (
                <form
                  action={attachInvoiceAction}
                  className="flex flex-wrap items-center gap-2 border-t border-black/5 pt-2 dark:border-white/10"
                >
                  <input type="hidden" name="quote_id" value={quote.id} />
                  <input type="hidden" name="company_id" value={pq.company_id} />
                  <input
                    type="file"
                    name="invoice_file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    required
                    className="text-xs"
                  />
                  <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
                    Adjuntar factura
                  </Button>
                </form>
              )}
            </GlassCard>
          ))}
        </section>
      )}

      {(quote.status === "ordered" || quote.status === "closed") && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-[var(--ink-muted)]">
            Cotejo de recepción
          </h2>
          {items.map((item) => {
            const fulfillment = fulfillmentByItem.get(item.id);
            const received = fulfillment?.received ?? null;
            return (
              <GlassCard key={item.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <Badge tone="blue">{companyShortCode.get(item.company_id) ?? "?"}</Badge>
                    {item.sku_snapshot && <Badge tone="sky">{item.sku_snapshot}</Badge>}
                    {item.product_name_snapshot} — {item.variant_name_snapshot}
                  </p>
                  <p className="text-xs text-[var(--ink-muted)]">
                    {item.units_per_package_snapshot
                      ? `${item.quantity_packages} paquete(s) × ${item.units_per_package_snapshot} pzas`
                      : `${item.quantity_units} unidad(es)`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {received === true && <Badge tone="green">✓ Recibido</Badge>}
                  {received === false && <Badge tone="neutral">✕ Faltante</Badge>}
                  {received === null && <Badge tone="sky">Pendiente</Badge>}
                  {quote.status === "ordered" && (
                    <>
                      <form action={updateFulfillmentAction}>
                        <input type="hidden" name="quote_id" value={quote.id} />
                        <input type="hidden" name="quote_item_id" value={item.id} />
                        <input type="hidden" name="received" value="true" />
                        <button type="submit" className="text-emerald-600 hover:opacity-70" title="Sí llegó">
                          ✓
                        </button>
                      </form>
                      <form action={updateFulfillmentAction}>
                        <input type="hidden" name="quote_id" value={quote.id} />
                        <input type="hidden" name="quote_item_id" value={item.id} />
                        <input type="hidden" name="received" value="false" />
                        <button type="submit" className="text-red-600 hover:opacity-70" title="No llegó">
                          ✕
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </GlassCard>
            );
          })}

          {missingItems.length > 0 && (
            <GlassCard className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Faltantes</h3>
                <a href={`/api/quotes/${quote.id}/pdf/missing`} target="_blank" rel="noreferrer">
                  <Button variant="secondary" className="px-3 py-1.5 text-xs">
                    Descargar listado
                  </Button>
                </a>
              </div>
              <ul className="list-inside list-disc space-y-1 text-sm text-[var(--ink-muted)]">
                {missingItems.map((item) => (
                  <li key={item.id}>
                    {item.sku_snapshot ? `[${item.sku_snapshot}] ` : ""}
                    {item.product_name_snapshot} — {item.variant_name_snapshot} (
                    {item.units_per_package_snapshot
                      ? `${item.quantity_packages} paquete(s)`
                      : `${item.quantity_units} unidad(es)`}
                    )
                  </li>
                ))}
              </ul>

              {quote.client_id && (
                <div className="border-t border-black/5 pt-3 dark:border-white/10">
                  {clientBackorder?.has_active_backorder ? (
                    <div className="space-y-2">
                      <p className="text-sm text-amber-700">
                        ⚠️ Back order activo
                        {clientBackorder.backorder_note ? `: ${clientBackorder.backorder_note}` : "."}
                      </p>
                      <form action={closeBackorderAction}>
                        <input type="hidden" name="quote_id" value={quote.id} />
                        <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
                          Descartar back order
                        </Button>
                      </form>
                    </div>
                  ) : (
                    <form action={setBackorderAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="quote_id" value={quote.id} />
                      <Input
                        name="backorder_note"
                        placeholder="Nota (opcional)"
                        className="max-w-xs"
                      />
                      <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
                        ¿Cliente acepta back order?
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </GlassCard>
          )}
        </section>
      )}

      <GlassCard strong>
        <h2 className="mb-4 text-sm font-medium">Datos del cliente</h2>
        <form action={updateQuoteHeaderAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="quote_id" value={quote.id} />

          <ClientDataFields
            defaults={{
              client_name: quote.client_name_snapshot,
              company_name: quote.company_name_snapshot,
              phone: quote.phone_snapshot ?? "",
              email: quote.email_snapshot ?? "",
              address: quote.address_snapshot ?? "",
            }}
            disabled={!editable}
          />

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Condición de compra</label>
            <select
              name="purchase_condition"
              defaultValue={quote.purchase_condition}
              disabled={!editable}
              className="w-full rounded-xl border border-black/10 bg-white/70 px-3.5 py-2.5 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-white/10 dark:bg-white/5"
            >
              <option value="credit">A crédito</option>
              <option value="prepaid">Pago anticipado</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Forma de pago</label>
            <select
              name="payment_method"
              defaultValue={quote.payment_method}
              disabled={!editable}
              className="w-full rounded-xl border border-black/10 bg-white/70 px-3.5 py-2.5 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-white/10 dark:bg-white/5"
            >
              <option value="transfer">Transferencia</option>
              <option value="deposit">Depósito bancario</option>
              <option value="cash">Efectivo (contra entrega en oficinas CDMX)</option>
            </select>
          </div>

          <div className="space-y-3 rounded-xl border border-black/5 p-4 dark:border-white/10 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="prompt_payment_enabled"
                defaultChecked={quote.prompt_payment_enabled}
                disabled={!editable}
              />
              Descuento por pago anticipado
            </label>
            <p className="text-xs text-[var(--ink-muted)]">
              Solo se aplica si la condición de compra es &quot;Pago anticipado&quot;.
            </p>
            <div className="flex items-center gap-2">
              <Input
                name="prompt_payment_pct"
                type="number"
                step="0.01"
                min="0"
                max="100"
                defaultValue={quote.prompt_payment_pct}
                disabled={!editable}
                className="w-28"
              />
              <span className="text-sm text-[var(--ink-muted)]">%</span>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="special_client_enabled"
                defaultChecked={quote.special_client_enabled}
                disabled={!editable}
              />
              Cliente especial (descuento por producto)
            </label>
            <p className="text-xs text-[var(--ink-muted)]">
              Al activarlo, captura el % de descuento directamente en cada línea de la tabla de abajo.
            </p>
          </div>

          {editable && (
            <Button type="submit" className="w-fit sm:col-span-2">
              Guardar datos
            </Button>
          )}
        </form>
      </GlassCard>

      {editable && <ProductPicker quoteId={quote.id} products={pickerProducts} />}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-[var(--ink-muted)]">Productos</h2>
        {items.length === 0 && (
          <GlassCard className="text-sm text-[var(--ink-muted)]">
            Todavía no has agregado productos.
          </GlassCard>
        )}
        {items.map((item) => (
          <GlassCard key={item.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex flex-wrap items-center gap-2 font-medium">
                <Badge tone="blue">{companyShortCode.get(item.company_id) ?? "?"}</Badge>
                {item.sku_snapshot && <Badge tone="sky">{item.sku_snapshot}</Badge>}
                {item.product_name_snapshot} — {item.variant_name_snapshot}
              </p>
              <p className="text-xs text-[var(--ink-muted)]">
                {item.units_per_package_snapshot
                  ? `${item.quantity_packages} paquete(s) × ${item.units_per_package_snapshot} pzas = ${item.quantity_units} unidades`
                  : `${item.quantity_units} unidad(es)`}{" "}
                × ${Number(item.unit_price_snapshot).toFixed(2)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {editable && (
                <form action={updateItemQuantityAction} className="flex items-center gap-1">
                  <input type="hidden" name="quote_id" value={quote.id} />
                  <input type="hidden" name="item_id" value={item.id} />
                  <input
                    name="quantity"
                    type="number"
                    step="1"
                    min="1"
                    defaultValue={item.quantity_packages ?? item.quantity_units}
                    title={item.units_per_package_snapshot ? "Número de paquetes" : "Cantidad de unidades"}
                    className="w-16 rounded-lg border border-black/10 bg-white/70 px-2 py-1 text-xs dark:border-white/10 dark:bg-white/5"
                  />
                  <button type="submit" className="text-xs text-brand-blue underline">
                    Actualizar
                  </button>
                </form>
              )}
              {quote.special_client_enabled && editable && (
                <form action={updateItemDiscountAction} className="flex items-center gap-1">
                  <input type="hidden" name="quote_id" value={quote.id} />
                  <input type="hidden" name="item_id" value={item.id} />
                  <input
                    name="discount_pct"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    defaultValue={item.discount_pct}
                    className="w-16 rounded-lg border border-black/10 bg-white/70 px-2 py-1 text-xs dark:border-white/10 dark:bg-white/5"
                  />
                  <span className="text-xs text-[var(--ink-muted)]">%</span>
                  <button type="submit" className="text-xs text-brand-blue underline">
                    Aplicar
                  </button>
                </form>
              )}
              <span className="font-medium">${Number(item.line_total).toFixed(2)}</span>
              {editable && (
                <form action={removeItemAction}>
                  <input type="hidden" name="quote_id" value={quote.id} />
                  <input type="hidden" name="item_id" value={item.id} />
                  <button
                    type="submit"
                    className="text-[var(--ink-muted)] hover:text-red-600"
                    title="Quitar"
                  >
                    ✕
                  </button>
                </form>
              )}
            </div>
          </GlassCard>
        ))}
      </section>

      <GlassCard strong className="ml-auto max-w-sm space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--ink-muted)]">Subtotal</span>
          <span>${Number(quote.subtotal).toFixed(2)}</span>
        </div>
        {quote.discount_total > 0 && (
          <div className="flex justify-between text-sm text-emerald-600">
            <span>Descuento pronto pago</span>
            <span>-${Number(quote.discount_total).toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-[var(--ink-muted)]">IVA ({Number(quote.iva_pct)}%)</span>
          <span>${Number(quote.iva_total).toFixed(2)}</span>
        </div>
        <div className="flex justify-between border-t border-black/10 pt-1.5 text-base font-semibold dark:border-white/10">
          <span>Total</span>
          <span>${Number(quote.grand_total).toFixed(2)}</span>
        </div>
      </GlassCard>
    </div>
  );
}
