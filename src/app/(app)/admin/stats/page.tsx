import { createClient } from "@/lib/supabase/server";
import { GlassCard } from "@/components/ui/glass-card";

function money(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 });
}

type QuoteRow = {
  id: string;
  seller_id: string;
  status: string;
  outcome: string;
  grand_total: number;
  invoiced_at: string | null;
};

export default async function AdminStatsPage() {
  const supabase = await createClient();

  const [{ data: quotesData }, { data: profilesData }, { data: companiesData }, { data: itemsData }] =
    await Promise.all([
      supabase.from("quotes").select("id, seller_id, status, outcome, grand_total, invoiced_at"),
      supabase.from("profiles").select("id, full_name").eq("role", "seller"),
      supabase.from("companies").select("id, name"),
      supabase.from("quote_items").select("quote_id, company_id, line_total"),
    ]);

  const quotes = (quotesData ?? []) as QuoteRow[];
  const sellers = (profilesData ?? []) as { id: string; full_name: string }[];
  const companies = (companiesData ?? []) as { id: string; name: string }[];
  const items = (itemsData ?? []) as { quote_id: string; company_id: string; line_total: number }[];

  const totalQuotes = quotes.length;
  const won = quotes.filter((q) => q.outcome === "won");
  const lost = quotes.filter((q) => q.outcome === "lost");
  const inProgress = quotes.filter((q) => q.outcome === "in_progress");
  const revenue = quotes
    .filter((q) => q.invoiced_at)
    .reduce((sum, q) => sum + Number(q.grand_total), 0);

  const statusCounts = new Map<string, number>();
  quotes.forEach((q) => statusCounts.set(q.status, (statusCounts.get(q.status) ?? 0) + 1));

  const bySeller = sellers.map((s) => {
    const sellerQuotes = quotes.filter((q) => q.seller_id === s.id);
    return {
      name: s.full_name,
      count: sellerQuotes.length,
      won: sellerQuotes.filter((q) => q.outcome === "won").length,
      revenue: sellerQuotes
        .filter((q) => q.invoiced_at)
        .reduce((sum, q) => sum + Number(q.grand_total), 0),
    };
  });

  const byCompany = companies.map((c) => {
    const companyItems = items.filter((i) => i.company_id === c.id);
    const quoteIds = new Set(companyItems.map((i) => i.quote_id));
    return {
      name: c.name,
      quoteCount: quoteIds.size,
      amount: companyItems.reduce((sum, i) => sum + Number(i.line_total), 0),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Estadísticas globales</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Todas las cotizaciones, de todos los vendedores.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard>
          <p className="text-xs text-[var(--ink-muted)]">Total cotizaciones</p>
          <p className="text-2xl font-semibold">{totalQuotes}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs text-[var(--ink-muted)]">Ganadas / En seguimiento / Perdidas</p>
          <p className="text-2xl font-semibold">
            {won.length} / {inProgress.length} / {lost.length}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs text-[var(--ink-muted)]">Importe facturado total</p>
          <p className="text-2xl font-semibold">{money(revenue)}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs text-[var(--ink-muted)]">Vendedores activos</p>
          <p className="text-2xl font-semibold">{sellers.length}</p>
        </GlassCard>
      </div>

      <GlassCard strong>
        <h2 className="mb-3 text-sm font-medium">Por estatus</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          {Array.from(statusCounts.entries()).map(([status, count]) => (
            <span key={status} className="rounded-full bg-black/5 px-3 py-1 dark:bg-white/10">
              {status}: <strong>{count}</strong>
            </span>
          ))}
        </div>
      </GlassCard>

      <GlassCard strong>
        <h2 className="mb-3 text-sm font-medium">Por vendedor</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-[var(--ink-muted)]">
                <th className="py-2 pr-3">Vendedor</th>
                <th className="py-2 pr-3">Cotizaciones</th>
                <th className="py-2 pr-3">Ganadas</th>
                <th className="py-2">Facturado</th>
              </tr>
            </thead>
            <tbody>
              {bySeller.map((s) => (
                <tr key={s.name} className="border-t border-black/5 dark:border-white/10">
                  <td className="py-2 pr-3">{s.name}</td>
                  <td className="py-2 pr-3">{s.count}</td>
                  <td className="py-2 pr-3">{s.won}</td>
                  <td className="py-2">{money(s.revenue)}</td>
                </tr>
              ))}
              {bySeller.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-2 text-[var(--ink-muted)]">
                    Todavía no hay vendedores dados de alta.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <GlassCard strong>
        <h2 className="mb-3 text-sm font-medium">Por empresa</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-[var(--ink-muted)]">
                <th className="py-2 pr-3">Empresa</th>
                <th className="py-2 pr-3">Cotizaciones con sus productos</th>
                <th className="py-2">Importe cotizado</th>
              </tr>
            </thead>
            <tbody>
              {byCompany.map((c) => (
                <tr key={c.name} className="border-t border-black/5 dark:border-white/10">
                  <td className="py-2 pr-3">{c.name}</td>
                  <td className="py-2 pr-3">{c.quoteCount}</td>
                  <td className="py-2">{money(c.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
