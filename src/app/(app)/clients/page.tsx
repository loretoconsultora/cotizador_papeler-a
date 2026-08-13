import { requireProfile } from "@/lib/auth/require-user";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { importClientsAction } from "./actions";

function money(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 });
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

type ClientRow = {
  id: string;
  client_name: string;
  company_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
};

type QuoteAggRow = {
  id: string;
  client_id: string | null;
  created_at: string;
  invoiced_at: string | null;
  grand_total: number;
};

type ClientWithStats = ClientRow & {
  orderCount: number;
  orderCountYear: number;
  ordersThisMonth: number;
  lastOrderAt: string | null;
  revenue: number;
};

const selectClass =
  "rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-white/10 dark:bg-white/5";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; month?: string; q?: string; sort?: string }>;
}) {
  const { supabase } = await requireProfile();
  const filters = await searchParams;

  const [{ data: clientsData }, { data: quotesData }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, client_name, company_name, phone, email, address, city")
      .order("client_name"),
    supabase.from("quotes").select("id, client_id, created_at, invoiced_at, grand_total"),
  ]);

  const clients = (clientsData ?? []) as ClientRow[];
  const quotes = ((quotesData ?? []) as QuoteAggRow[]).filter((q) => q.client_id);

  const now = new Date();
  const currentYear = now.getFullYear();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const statsByClient = new Map<
    string,
    { orderCount: number; orderCountYear: number; ordersThisMonth: number; lastOrderAt: string | null; revenue: number }
  >();
  for (const q of quotes) {
    const clientId = q.client_id as string;
    const s = statsByClient.get(clientId) ?? {
      orderCount: 0,
      orderCountYear: 0,
      ordersThisMonth: 0,
      lastOrderAt: null as string | null,
      revenue: 0,
    };
    s.orderCount += 1;
    const created = new Date(q.created_at);
    if (created.getFullYear() === currentYear) s.orderCountYear += 1;
    if (created >= startOfMonth) s.ordersThisMonth += 1;
    if (!s.lastOrderAt || created > new Date(s.lastOrderAt)) s.lastOrderAt = q.created_at;
    if (q.invoiced_at) s.revenue += Number(q.grand_total);
    statsByClient.set(clientId, s);
  }

  const allRows: ClientWithStats[] = clients.map((c) => {
    const s = statsByClient.get(c.id);
    return {
      ...c,
      orderCount: s?.orderCount ?? 0,
      orderCountYear: s?.orderCountYear ?? 0,
      ordersThisMonth: s?.ordersThisMonth ?? 0,
      lastOrderAt: s?.lastOrderAt ?? null,
      revenue: s?.revenue ?? 0,
    };
  });

  const topClient = [...allRows].sort((a, b) => b.revenue - a.revenue).find((r) => r.revenue > 0);
  const top5Revenue = [...allRows]
    .filter((r) => r.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
  const top5Frequent = [...allRows]
    .filter((r) => r.orderCount > 0)
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, 5);

  const cities = Array.from(new Set(clients.map((c) => c.city).filter(Boolean))).sort() as string[];

  let rows = [...allRows];
  if (filters.city) rows = rows.filter((r) => r.city === filters.city);
  if (filters.month === "1") rows = rows.filter((r) => r.ordersThisMonth > 0);
  if (filters.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter(
      (r) => r.client_name.toLowerCase().includes(q) || r.company_name.toLowerCase().includes(q)
    );
  }

  const sort = filters.sort ?? "last_order";
  rows.sort((a, b) => {
    if (sort === "revenue") return b.revenue - a.revenue;
    if (sort === "order_count") return b.orderCount - a.orderCount;
    const at = a.lastOrderAt ? new Date(a.lastOrderAt).getTime() : 0;
    const bt = b.lastOrderAt ? new Date(b.lastOrderAt).getTime() : 0;
    return bt - at;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Todos los clientes cargados (por facturación o importados), con su historial de pedidos.
        </p>
      </div>

      {topClient && (
        <GlassCard strong className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-[var(--ink-muted)]">⭐ Cliente estrella (mayor facturación)</p>
            <p className="text-lg font-semibold">
              {topClient.client_name} <span className="text-[var(--ink-muted)]">· {topClient.company_name}</span>
            </p>
          </div>
          <p className="text-xl font-semibold text-brand-blue">{money(topClient.revenue)}</p>
        </GlassCard>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <GlassCard strong>
          <h2 className="mb-3 text-sm font-medium">🏆 Top 5 por facturación</h2>
          {top5Revenue.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">Todavía no hay pedidos facturados.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {top5Revenue.map((r, idx) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {idx + 1}. {r.client_name} · {r.company_name}
                  </span>
                  <span className="shrink-0 font-medium">{money(r.revenue)}</span>
                </li>
              ))}
            </ol>
          )}
        </GlassCard>
        <GlassCard strong>
          <h2 className="mb-3 text-sm font-medium">🔁 Top 5 clientes frecuentes</h2>
          {top5Frequent.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">Todavía no hay pedidos registrados.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {top5Frequent.map((r, idx) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {idx + 1}. {r.client_name} · {r.company_name}
                  </span>
                  <span className="shrink-0 font-medium">{r.orderCount} pedido(s)</span>
                </li>
              ))}
            </ol>
          )}
        </GlassCard>
      </div>

      <GlassCard strong>
        <h2 className="mb-3 text-sm font-medium">Importar clientes desde Excel</h2>
        <p className="mb-3 text-xs text-[var(--ink-muted)]">
          .xlsx con encabezados en la primera fila: nombre, empresa, teléfono, correo, dirección, ciudad
          (en cualquier orden).
        </p>
        <form action={importClientsAction} className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            name="file"
            accept=".xlsx"
            required
            className="text-xs"
          />
          <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
            Importar
          </Button>
        </form>
      </GlassCard>

      <GlassCard strong>
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" method="get">
          <Input name="q" placeholder="Buscar cliente o empresa…" defaultValue={filters.q ?? ""} />
          <select name="city" defaultValue={filters.city ?? ""} className={selectClass}>
            <option value="">Todas las ciudades</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select name="sort" defaultValue={sort} className={selectClass}>
            <option value="last_order">Ordenar: Último pedido</option>
            <option value="revenue">Ordenar: Facturación</option>
            <option value="order_count">Ordenar: # de pedidos</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="month" value="1" defaultChecked={filters.month === "1"} />
            Con pedido este mes
          </label>
          <Button type="submit" variant="secondary" className="px-3 py-2 text-sm">
            Filtrar
          </Button>
        </form>
      </GlassCard>

      <GlassCard strong>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-[var(--ink-muted)]">
                <th className="py-2 pr-3">Nombre</th>
                <th className="py-2 pr-3">Empresa</th>
                <th className="py-2 pr-3">Teléfono</th>
                <th className="py-2 pr-3">Correo</th>
                <th className="py-2 pr-3">Ciudad</th>
                <th className="py-2 pr-3">Último pedido</th>
                <th className="py-2 pr-3"># Pedidos (año)</th>
                <th className="py-2">Facturación</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-black/5 dark:border-white/10">
                  <td className="py-2 pr-3">{r.client_name}</td>
                  <td className="py-2 pr-3">{r.company_name}</td>
                  <td className="py-2 pr-3">{r.phone || "—"}</td>
                  <td className="py-2 pr-3">{r.email || "—"}</td>
                  <td className="py-2 pr-3">{r.city || "—"}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDate(r.lastOrderAt)}</td>
                  <td className="py-2 pr-3">
                    {r.orderCount} ({r.orderCountYear} este año)
                  </td>
                  <td className="py-2 font-medium">{money(r.revenue)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-[var(--ink-muted)]">
                    No hay clientes que coincidan con estos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
