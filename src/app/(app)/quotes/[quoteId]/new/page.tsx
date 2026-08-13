import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/confirm-button";
import { ProductPicker } from "@/components/quotes/product-picker";
import { ClientDataFields } from "@/components/quotes/client-data-fields";
import { removeItemAction, updateItemQuantityAction } from "../actions";
import { wizardSaveClientAction, confirmQuoteAction } from "./actions";

type QuoteRow = {
  id: string;
  folio: string;
  confirmed_at: string | null;
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
  subtotal: number;
  discount_total: number;
  iva_total: number;
  iva_pct: number;
  grand_total: number;
};

type ItemRow = {
  id: string;
  company_id: string;
  sku_snapshot: string;
  product_name_snapshot: string;
  variant_name_snapshot: string;
  unit_price_snapshot: number;
  quantity_packages: number | null;
  units_per_package_snapshot: number | null;
  quantity_units: number;
  line_total: number;
};

const selectClass =
  "w-full rounded-xl border border-black/10 bg-white/70 px-3.5 py-2.5 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-white/10 dark:bg-white/5";

function money(n: number) {
  return Number(n).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

export default async function NewQuoteWizardPage({
  params,
  searchParams,
}: {
  params: Promise<{ quoteId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { quoteId } = await params;
  const { step: stepParam } = await searchParams;
  const supabase = await createClient();

  const { data: quoteData } = await supabase
    .from("quotes")
    .select(
      "id, folio, confirmed_at, client_name_snapshot, company_name_snapshot, phone_snapshot, email_snapshot, address_snapshot, purchase_condition, payment_method, prompt_payment_enabled, prompt_payment_pct, special_client_enabled, subtotal, discount_total, iva_total, iva_pct, grand_total"
    )
    .eq("id", quoteId)
    .single();
  if (!quoteData) notFound();
  const quote = quoteData as QuoteRow;

  const [{ data: itemsData }, { data: companiesData }, { data: productsData }] = await Promise.all([
    supabase
      .from("quote_items")
      .select(
        "id, company_id, sku_snapshot, product_name_snapshot, variant_name_snapshot, unit_price_snapshot, quantity_packages, units_per_package_snapshot, quantity_units, line_total"
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
  ]);

  const items = (itemsData ?? []) as ItemRow[];
  const companies = (companiesData ?? []) as { id: string; name: string; short_code: string }[];
  const companyShortCode = new Map(companies.map((c) => [c.id, c.short_code]));

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

  function computeDefaultStep() {
    if (!quote.client_name_snapshot || !quote.company_name_snapshot) return 1;
    if (items.length === 0) return 2;
    return 3;
  }
  const requested = Number(stepParam);
  const step = requested >= 1 && requested <= 4 ? requested : computeDefaultStep();

  if (step >= 2 && (!quote.client_name_snapshot || !quote.company_name_snapshot)) {
    redirect(`/quotes/${quoteId}/new?step=1`);
  }
  if (step >= 4 && !quote.confirmed_at) {
    redirect(`/quotes/${quoteId}/new?step=3`);
  }

  const steps = [
    { n: 1, label: "Cliente" },
    { n: 2, label: "Productos" },
    { n: 3, label: "Confirmar" },
    { n: 4, label: "Resumen" },
  ];

  function ItemRowCard({ item, showQuantityEdit }: { item: ItemRow; showQuantityEdit: boolean }) {
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
              ? `${item.quantity_packages} paquete(s) × ${item.units_per_package_snapshot} pzas = ${item.quantity_units} unidades`
              : `${item.quantity_units} unidad(es)`}{" "}
            × ${Number(item.unit_price_snapshot).toFixed(2)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {showQuantityEdit && (
            <form action={updateItemQuantityAction} className="flex items-center gap-1">
              <input type="hidden" name="quote_id" value={quoteId} />
              <input type="hidden" name="item_id" value={item.id} />
              <input
                name="quantity"
                type="number"
                step="1"
                min="1"
                defaultValue={item.quantity_packages ?? item.quantity_units}
                className="w-16 rounded-lg border border-black/10 bg-white/70 px-2 py-1 text-xs dark:border-white/10 dark:bg-white/5"
              />
              <button type="submit" className="text-xs text-brand-blue underline">
                Actualizar
              </button>
            </form>
          )}
          <span className="font-medium">${Number(item.line_total).toFixed(2)}</span>
          <form action={removeItemAction}>
            <input type="hidden" name="quote_id" value={quoteId} />
            <input type="hidden" name="item_id" value={item.id} />
            <button type="submit" className="text-[var(--ink-muted)] hover:text-red-600" title="Quitar">
              ✕
            </button>
          </form>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-[var(--ink-muted)]">{quote.folio}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Cotización nueva</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {steps.map((s, idx) => (
          <span key={s.n} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                s.n === step
                  ? "bg-brand-blue text-white"
                  : s.n < step
                    ? "bg-brand-blue/15 text-brand-blue"
                    : "bg-black/5 text-[var(--ink-muted)] dark:bg-white/10"
              }`}
            >
              {s.n}
            </span>
            <span className={s.n === step ? "font-medium" : "text-[var(--ink-muted)]"}>{s.label}</span>
            {idx < steps.length - 1 && <span className="text-[var(--ink-muted)]">—</span>}
          </span>
        ))}
      </div>

      {step === 1 && (
        <GlassCard strong>
          <h2 className="mb-4 text-sm font-medium">Datos del cliente</h2>
          <form action={wizardSaveClientAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="quote_id" value={quoteId} />
            <ClientDataFields
              defaults={{
                client_name: quote.client_name_snapshot,
                company_name: quote.company_name_snapshot,
                phone: quote.phone_snapshot ?? "",
                email: quote.email_snapshot ?? "",
                address: quote.address_snapshot ?? "",
              }}
            />

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Condición de compra</label>
              <select
                name="purchase_condition"
                defaultValue={quote.purchase_condition}
                className={selectClass}
              >
                <option value="credit">A crédito</option>
                <option value="prepaid">Pago anticipado</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Forma de pago</label>
              <select name="payment_method" defaultValue={quote.payment_method} className={selectClass}>
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
                  className="w-28"
                />
                <span className="text-sm text-[var(--ink-muted)]">%</span>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  name="special_client_enabled"
                  defaultChecked={quote.special_client_enabled}
                />
                Cliente especial (descuento por producto)
              </label>
            </div>

            <Button type="submit" className="w-fit sm:col-span-2">
              Continuar → Productos
            </Button>
          </form>
        </GlassCard>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <GlassCard className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-[var(--ink-muted)]">
              {quote.client_name_snapshot} · {quote.company_name_snapshot}
            </p>
            <Link href={`/quotes/${quoteId}/new?step=1`} className="text-xs text-brand-blue underline">
              Editar datos del cliente
            </Link>
          </GlassCard>

          <ProductPicker quoteId={quoteId} products={pickerProducts} />

          <section className="space-y-3">
            {items.length === 0 && (
              <GlassCard className="text-sm text-[var(--ink-muted)]">
                Todavía no has agregado productos.
              </GlassCard>
            )}
            {items.map((item) => (
              <ItemRowCard key={item.id} item={item} showQuantityEdit={false} />
            ))}
          </section>

          {items.length > 0 && (
            <Link href={`/quotes/${quoteId}/new?step=3`}>
              <Button className="w-fit">Continuar → Confirmar pedido</Button>
            </Link>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <GlassCard>
            <h2 className="mb-2 text-sm font-medium text-[var(--ink-muted)]">Revisa el pedido</h2>
            <p className="text-sm">
              {quote.client_name_snapshot} · {quote.company_name_snapshot}
            </p>
          </GlassCard>

          <section className="space-y-3">
            {items.map((item) => (
              <ItemRowCard key={item.id} item={item} showQuantityEdit />
            ))}
          </section>

          <GlassCard strong className="ml-auto max-w-sm space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--ink-muted)]">Subtotal</span>
              <span>{money(quote.subtotal)}</span>
            </div>
            {quote.discount_total > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Descuento pronto pago</span>
                <span>-{money(quote.discount_total)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-[var(--ink-muted)]">IVA ({Number(quote.iva_pct)}%)</span>
              <span>{money(quote.iva_total)}</span>
            </div>
            <div className="flex justify-between border-t border-black/10 pt-1.5 text-base font-semibold dark:border-white/10">
              <span>Total</span>
              <span>{money(quote.grand_total)}</span>
            </div>
          </GlassCard>

          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/quotes/${quoteId}/new?step=2`}>
              <Button variant="secondary">← Atrás, agregar más productos</Button>
            </Link>
            <form action={confirmQuoteAction}>
              <input type="hidden" name="quote_id" value={quoteId} />
              <ConfirmButton
                confirmMessage="¿Confirmar este pedido? Podrás seguir editándolo después desde el detalle completo."
              >
                Confirmar pedido
              </ConfirmButton>
            </form>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <GlassCard strong className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge tone="green">✓ Pedido confirmado</Badge>
              <span className="text-sm text-[var(--ink-muted)]">{quote.folio}</span>
            </div>
            <h2 className="text-xl font-semibold">
              {quote.client_name_snapshot} · {quote.company_name_snapshot}
            </h2>
            <p className="text-sm text-[var(--ink-muted)]">
              {items.length} producto(s) — Total {money(quote.grand_total)}
            </p>
          </GlassCard>

          <div className="flex flex-wrap gap-3">
            <a href={`/api/quotes/${quoteId}/pdf/client`} target="_blank" rel="noreferrer">
              <Button variant="secondary">Descargar PDF</Button>
            </a>
            <a
              href={`/api/quotes/${quoteId}/pdf/client/whatsapp`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-medium text-white transition hover:brightness-95"
            >
              Enviar por WhatsApp
            </a>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <Link href={`/quotes/${quoteId}`} className="text-brand-blue underline">
              Ver cotización completa (aprobar, factura, etc.)
            </Link>
            <Link href="/quotes" className="text-[var(--ink-muted)] underline">
              Volver a Cotizaciones
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
