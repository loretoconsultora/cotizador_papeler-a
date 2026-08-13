/**
 * Cálculo de KPIs mensuales por vendedor (y también reutilizable para el
 * dashboard global del admin). Todo se calcula en memoria a partir de las
 * cotizaciones ya traídas de Supabase — el volumen esperado (decenas de
 * cotizaciones al mes) hace innecesaria una agregación en SQL.
 *
 * Definiciones (ver decisión documentada al usuario):
 *  - "cotizaciones" del mes = creadas ese mes (created_at).
 *  - "clientes ganados" = cotizaciones con outcome='won' cuyo won_at cae en
 *    ese mes (no necesariamente creadas ese mismo mes).
 *  - "importe vendido" = suma de grand_total de cotizaciones cuyo
 *    invoiced_at cae en ese mes (el momento en que el proveedor facturó).
 *  - "% conversión" = ganadas del mes / cotizaciones creadas ese mes.
 *  - "ticket promedio" = promedio de grand_total de las cotizaciones
 *    ganadas ese mes.
 */

export type StatsQuote = {
  created_at: string;
  won_at: string | null;
  invoiced_at: string | null;
  grand_total: number;
};

export type MonthStats = {
  key: string;
  label: string;
  quotesCount: number;
  wonCount: number;
  revenue: number;
  conversionPct: number;
  avgTicket: number;
};

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function computeMonthlyStats(quotes: StatsQuote[], monthsBack = 6): MonthStats[] {
  const now = new Date();
  const months: MonthStats[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });

    const created = quotes.filter((q) => monthKey(q.created_at) === key);
    const won = quotes.filter((q) => q.won_at && monthKey(q.won_at) === key);
    const invoiced = quotes.filter((q) => q.invoiced_at && monthKey(q.invoiced_at) === key);

    const quotesCount = created.length;
    const wonCount = won.length;
    const revenue = invoiced.reduce((sum, q) => sum + Number(q.grand_total), 0);
    const conversionPct = quotesCount > 0 ? (wonCount / quotesCount) * 100 : 0;
    const avgTicket =
      wonCount > 0 ? won.reduce((sum, q) => sum + Number(q.grand_total), 0) / wonCount : 0;

    months.push({ key, label, quotesCount, wonCount, revenue, conversionPct, avgTicket });
  }

  return months;
}

/** null cuando el mes anterior no tiene base para comparar (0 y 0 no es crecimiento). */
export function growthPct(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}
