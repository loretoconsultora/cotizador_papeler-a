/**
 * "Producto estrella": agregación de quote_items por producto, para saber
 * qué se vende más (unidades) y qué deja más ingreso (facturación).
 *
 * Decisión (informada, no preguntada): "vendido"/"facturación" usa el mismo
 * criterio que el resto del dashboard — solo cuenta líneas de cotizaciones
 * ya facturadas (invoiced_at no nulo), igual que "Importe vendido" en
 * stats.ts. Una cotización en borrador o aprobada no es todavía una venta.
 *
 * El caller debe unir cada quote_item con el invoiced_at de su cotización
 * (join en memoria) antes de pasarlo aquí — ver /products/page.tsx.
 */

export type ProductSaleItem = {
  quote_id: string;
  product_id: string;
  product_name_snapshot: string;
  company_id: string;
  quantity_units: number;
  line_total: number;
  invoiced_at: string | null;
};

export type ProductAgg = {
  productId: string;
  name: string;
  companyId: string;
  units: number;
  revenue: number;
};

export type MonthProductStats = {
  key: string;
  label: string;
  topByUnits: ProductAgg[];
  topByRevenue: ProductAgg[];
};

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function aggregateByProduct(items: ProductSaleItem[]): ProductAgg[] {
  const byProduct = new Map<string, ProductAgg>();
  for (const item of items) {
    if (!item.invoiced_at) continue;
    const existing = byProduct.get(item.product_id);
    if (existing) {
      existing.units += item.quantity_units;
      existing.revenue += Number(item.line_total);
    } else {
      byProduct.set(item.product_id, {
        productId: item.product_id,
        name: item.product_name_snapshot,
        companyId: item.company_id,
        units: item.quantity_units,
        revenue: Number(item.line_total),
      });
    }
  }
  return Array.from(byProduct.values());
}

/** Top N productos de todo el historial facturado, por unidades o por facturación. */
export function computeTopProducts(
  items: ProductSaleItem[],
  by: "units" | "revenue",
  limit = 3
): ProductAgg[] {
  const aggregated = aggregateByProduct(items);
  return aggregated.sort((a, b) => b[by] - a[by]).slice(0, limit);
}

/** Historial mensual: top 3 por unidades y top 3 por facturación de cada mes. */
export function computeMonthlyProductStats(
  items: ProductSaleItem[],
  monthsBack = 6
): MonthProductStats[] {
  const now = new Date();
  const months: MonthProductStats[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });

    const monthItems = items.filter((it) => it.invoiced_at && monthKey(it.invoiced_at) === key);
    const aggregated = aggregateByProduct(monthItems);

    months.push({
      key,
      label,
      topByUnits: [...aggregated].sort((a, b) => b.units - a.units).slice(0, 3),
      topByRevenue: [...aggregated].sort((a, b) => b.revenue - a.revenue).slice(0, 3),
    });
  }

  return months;
}
