import { requireProfile } from "@/lib/auth/require-user";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import {
  computeTopProducts,
  computeMonthlyProductStats,
  type ProductSaleItem,
  type ProductAgg,
} from "@/lib/quotes/product-stats";

function money(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 });
}

type ItemRow = {
  quote_id: string;
  product_id: string;
  product_name_snapshot: string;
  company_id: string;
  quantity_units: number;
  line_total: number;
  quotes: { invoiced_at: string | null } | { invoiced_at: string | null }[] | null;
};

type CatalogRow = {
  id: string;
  company_id: string;
  file_path: string;
  file_name: string;
  created_at: string;
  companies: { name: string } | { name: string }[] | null;
};

function oneOf<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function ProductsPage() {
  const { supabase } = await requireProfile();

  const [{ data: itemsData }, { data: companiesData }, { data: catalogsData }] = await Promise.all([
    supabase
      .from("quote_items")
      .select("quote_id, product_id, product_name_snapshot, company_id, quantity_units, line_total, quotes(invoiced_at)"),
    supabase.from("companies").select("id, name").order("name"),
    supabase
      .from("company_catalogs")
      .select("id, company_id, file_path, file_name, created_at, companies(name)")
      .order("created_at", { ascending: false }),
  ]);

  const companies = (companiesData ?? []) as { id: string; name: string }[];
  const companyName = new Map(companies.map((c) => [c.id, c.name]));

  const items: ProductSaleItem[] = ((itemsData ?? []) as ItemRow[]).map((row) => ({
    quote_id: row.quote_id,
    product_id: row.product_id,
    product_name_snapshot: row.product_name_snapshot,
    company_id: row.company_id,
    quantity_units: row.quantity_units,
    line_total: Number(row.line_total),
    invoiced_at: oneOf(row.quotes)?.invoiced_at ?? null,
  }));

  const topByUnits = computeTopProducts(items, "units", 3);
  const topByRevenue = computeTopProducts(items, "revenue", 3);
  const months = computeMonthlyProductStats(items, 6);

  const catalogs = (catalogsData ?? []) as CatalogRow[];
  const catalogsByCompany = new Map<string, CatalogRow[]>();
  catalogs.forEach((c) => {
    const list = catalogsByCompany.get(c.company_id) ?? [];
    list.push(c);
    catalogsByCompany.set(c.company_id, list);
  });

  function rankList(list: ProductAgg[], metric: "units" | "revenue") {
    if (list.length === 0) {
      return (
        <p className="text-sm text-[var(--ink-muted)]">
          Todavía no hay ventas facturadas para calcular esto.
        </p>
      );
    }
    return (
      <ol className="space-y-2">
        {list.map((p, idx) => (
          <li key={p.productId} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-xs font-semibold text-brand-blue">
                {idx + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{p.name}</p>
                <p className="text-xs text-[var(--ink-muted)]">
                  {companyName.get(p.companyId) ?? ""}
                </p>
              </div>
            </div>
            <span className="shrink-0 font-medium">
              {metric === "units" ? `${p.units} u.` : money(p.revenue)}
            </span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Productos estrella (según cotizaciones ya facturadas) y catálogos para enviar al cliente.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <GlassCard strong>
          <h2 className="mb-3 text-sm font-medium">Top 3 más vendidos (unidades)</h2>
          {rankList(topByUnits, "units")}
        </GlassCard>
        <GlassCard strong>
          <h2 className="mb-3 text-sm font-medium">Top 3 mayor facturación</h2>
          {rankList(topByRevenue, "revenue")}
        </GlassCard>
      </div>

      <GlassCard strong>
        <h2 className="mb-3 text-sm font-medium">Historial mensual de productos estrella</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-[var(--ink-muted)]">
                <th className="py-2 pr-3">Mes</th>
                <th className="py-2 pr-3">Top por unidades</th>
                <th className="py-2">Top por facturación</th>
              </tr>
            </thead>
            <tbody>
              {[...months].reverse().map((m) => (
                <tr key={m.key} className="border-t border-black/5 align-top dark:border-white/10">
                  <td className="whitespace-nowrap py-2 pr-3 capitalize">{m.label}</td>
                  <td className="py-2 pr-3">
                    {m.topByUnits.length === 0 ? (
                      <span className="text-[var(--ink-muted)]">—</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {m.topByUnits.map((p) => (
                          <li key={p.productId}>
                            {p.name} <span className="text-[var(--ink-muted)]">({p.units} u.)</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="py-2">
                    {m.topByRevenue.length === 0 ? (
                      <span className="text-[var(--ink-muted)]">—</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {m.topByRevenue.map((p) => (
                          <li key={p.productId}>
                            {p.name}{" "}
                            <span className="text-[var(--ink-muted)]">({money(p.revenue)})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <GlassCard strong>
        <h2 className="mb-1 text-sm font-medium">Catálogos por empresa</h2>
        <p className="mb-4 text-xs text-[var(--ink-muted)]">
          Los catálogos vigentes que subió el admin. &quot;Enviar por WhatsApp&quot; abre WhatsApp
          con el enlace del catálogo listo para pegar al chat del cliente.
        </p>
        <div className="space-y-4">
          {companies
            .filter((c) => catalogsByCompany.has(c.id))
            .map((c) => (
              <div key={c.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  <Badge tone="blue">{catalogsByCompany.get(c.id)!.length}</Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {catalogsByCompany.get(c.id)!.map((cat) => {
                    const { data: pub } = supabase.storage
                      .from("company-catalogs")
                      .getPublicUrl(cat.file_path);
                    const url = pub.publicUrl;
                    const waText = encodeURIComponent(
                      `Catálogo ${c.name}: ${url}`
                    );
                    return (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-black/10 bg-white/60 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                      >
                        <span className="min-w-0 truncate">{cat.file_name}</span>
                        <div className="flex shrink-0 gap-1.5">
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full px-2.5 py-1 text-xs font-medium text-brand-blue hover:bg-brand-blue/10"
                          >
                            Ver
                          </a>
                          <a
                            href={`https://wa.me/?text=${waText}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full bg-[#25D366]/10 px-2.5 py-1 text-xs font-medium text-[#128C4A] hover:bg-[#25D366]/20"
                          >
                            WhatsApp
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          {catalogs.length === 0 && (
            <p className="text-sm text-[var(--ink-muted)]">
              Todavía no hay catálogos cargados. El admin puede subirlos desde Admin → Catálogo → Empresas.
            </p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
