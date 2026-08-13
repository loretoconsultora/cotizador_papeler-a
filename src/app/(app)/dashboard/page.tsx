import Link from "next/link";
import { requireProfile } from "@/lib/auth/require-user";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { computeMonthlyStats, growthPct, type StatsQuote } from "@/lib/quotes/stats";

function money(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 });
}

function pct(n: number) {
  return `${n.toFixed(1)}%`;
}

export default async function DashboardPage() {
  const { profile, supabase, user } = await requireProfile();

  if (profile.role === "admin") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hola, {profile.full_name}</h1>
          <p className="text-sm text-[var(--ink-muted)]">Panel de administrador.</p>
        </div>
        <GlassCard className="space-y-3">
          <p className="text-sm text-[var(--ink-muted)]">
            Los indicadores globales (ganadas/perdidas, por vendedor, por empresa) están en
            Admin → Estadísticas.
          </p>
          <Link href="/admin/stats">
            <Button className="w-fit">Ver estadísticas globales</Button>
          </Link>
        </GlassCard>
      </div>
    );
  }

  // Vendedor: KPIs mensuales propios. Traemos las cotizaciones de los últimos
  // 7 meses (suficiente para calcular el mes actual + 6 de historial) —
  // el volumen esperado hace innecesaria una agregación en SQL.
  const sevenMonthsAgo = new Date();
  sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 6);
  sevenMonthsAgo.setDate(1);

  const { data } = await supabase
    .from("quotes")
    .select("created_at, won_at, invoiced_at, grand_total")
    .eq("seller_id", user.id)
    .gte("created_at", sevenMonthsAgo.toISOString());

  const quotes = (data ?? []) as StatsQuote[];
  const months = computeMonthlyStats(quotes, 6);
  const current = months[months.length - 1];
  const previous = months[months.length - 2];
  const revenueGrowth = growthPct(current.revenue, previous.revenue);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hola, {profile.full_name}</h1>
        <p className="text-sm text-[var(--ink-muted)] capitalize">{current.label}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <GlassCard>
          <p className="text-xs text-[var(--ink-muted)]">Cotizaciones</p>
          <p className="text-2xl font-semibold">{current.quotesCount}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs text-[var(--ink-muted)]">Clientes ganados</p>
          <p className="text-2xl font-semibold">{current.wonCount}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs text-[var(--ink-muted)]">Importe vendido (facturado)</p>
          <p className="text-2xl font-semibold">{money(current.revenue)}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs text-[var(--ink-muted)]">% Conversión</p>
          <p className="text-2xl font-semibold">{pct(current.conversionPct)}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs text-[var(--ink-muted)]">Ticket promedio</p>
          <p className="text-2xl font-semibold">{money(current.avgTicket)}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs text-[var(--ink-muted)]">% Crecimiento vs. mes anterior</p>
          <p
            className={`text-2xl font-semibold ${
              revenueGrowth !== null && revenueGrowth < 0 ? "text-red-600" : "text-emerald-600"
            }`}
          >
            {revenueGrowth === null ? "—" : `${revenueGrowth >= 0 ? "+" : ""}${pct(revenueGrowth)}`}
          </p>
        </GlassCard>
      </div>

      <GlassCard strong>
        <h2 className="mb-3 text-sm font-medium">Historial de meses anteriores</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-[var(--ink-muted)]">
                <th className="py-2 pr-3">Mes</th>
                <th className="py-2 pr-3">Cotizaciones</th>
                <th className="py-2 pr-3">Ganadas</th>
                <th className="py-2 pr-3">Vendido</th>
                <th className="py-2 pr-3">% Conversión</th>
                <th className="py-2">Ticket prom.</th>
              </tr>
            </thead>
            <tbody>
              {[...months].reverse().map((m) => (
                <tr key={m.key} className="border-t border-black/5 dark:border-white/10">
                  <td className="py-2 pr-3 capitalize">{m.label}</td>
                  <td className="py-2 pr-3">{m.quotesCount}</td>
                  <td className="py-2 pr-3">{m.wonCount}</td>
                  <td className="py-2 pr-3">{money(m.revenue)}</td>
                  <td className="py-2 pr-3">{pct(m.conversionPct)}</td>
                  <td className="py-2">{money(m.avgTicket)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
