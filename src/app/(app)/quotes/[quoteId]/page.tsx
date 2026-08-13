import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductPicker } from "@/components/quotes/product-picker";
import { removeItemAction, updateItemDiscountAction, updateQuoteHeaderAction } from "./actions";

type Quote = {
  id: string;
  folio: string;
  status: string;
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
      "id, folio, status, client_id, client_name_snapshot, company_name_snapshot, phone_snapshot, email_snapshot, address_snapshot, purchase_condition, payment_method, prompt_payment_enabled, prompt_payment_pct, special_client_enabled, rfc_snapshot, tax_regime_snapshot, cfdi_use_snapshot, carrier_name, delivery_type, delivery_address, subtotal, discount_total, iva_total, iva_pct, grand_total"
    )
    .eq("id", quoteId)
    .single();

  if (!quoteData) notFound();
  const quote = quoteData as Quote;
  const editable = quote.status !== "closed";

  let fiscalDocUrl: string | null = null;
  if (quote.client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("fiscal_doc_path")
      .eq("id", quote.client_id)
      .single();
    if (client?.fiscal_doc_path) {
      const { data: signed } = await supabase.storage
        .from("fiscal-docs")
        .createSignedUrl(client.fiscal_doc_path, 60 * 10);
      fiscalDocUrl = signed?.signedUrl ?? null;
    }
  }

  const [{ data: itemsData }, { data: companiesData }, { data: productsData }] =
    await Promise.all([
      supabase
        .from("quote_items")
        .select(
          "id, company_id, sku_snapshot, product_name_snapshot, variant_name_snapshot, unit_price_snapshot, quantity_packages, units_per_package_snapshot, quantity_units, discount_pct, line_total"
        )
        .eq("quote_id", quoteId)
        .order("sort_order")
        .order("created_at"),
      supabase.from("companies").select("id, short_code"),
      supabase
        .from("products")
        .select(
          "id, name, company_id, companies(name), product_variants(id, name, sku, unit_price, active, product_packages(id, units_per_package, label, active))"
        )
        .eq("active", true)
        .order("name"),
    ]);

  const items = (itemsData ?? []) as QuoteItem[];
  const companyShortCode = new Map(
    (companiesData ?? []).map((c: { id: string; short_code: string }) => [c.id, c.short_code])
  );

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
        <div className="flex items-center gap-2">
          <Badge tone="blue">{STATUS_LABEL[quote.status] ?? quote.status}</Badge>
          {quote.status === "draft" && (
            <Link href={`/quotes/${quote.id}/approve`}>
              <Button variant="primary" className="px-4 py-2 text-sm">
                Marcar como Aprobada
              </Button>
            </Link>
          )}
        </div>
      </div>

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

      <GlassCard strong>
        <h2 className="mb-4 text-sm font-medium">Datos del cliente</h2>
        <form action={updateQuoteHeaderAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="quote_id" value={quote.id} />

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nombre del cliente</label>
            <Input name="client_name" defaultValue={quote.client_name_snapshot} required disabled={!editable} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Empresa</label>
            <Input name="company_name" defaultValue={quote.company_name_snapshot} required disabled={!editable} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Teléfono</label>
            <Input name="phone" defaultValue={quote.phone_snapshot ?? ""} disabled={!editable} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Correo</label>
            <Input name="email" type="email" defaultValue={quote.email_snapshot ?? ""} disabled={!editable} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium">Dirección de la empresa</label>
            <Input name="address" defaultValue={quote.address_snapshot ?? ""} disabled={!editable} />
          </div>

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
                <Badge tone="sky">{companyShortCode.get(item.company_id) ?? "?"}</Badge>
                {item.sku_snapshot && <Badge tone="blue">{item.sku_snapshot}</Badge>}
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
