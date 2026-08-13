/**
 * Cálculo de totales de una cotización. Función pura, sin I/O — se usa tanto
 * en el navegador (preview instantáneo) como en el servidor (fuente de
 * verdad antes de persistir). Nunca confiar en un total calculado en el
 * cliente: siempre se recalcula aquí antes de guardar.
 *
 * Fórmula:
 *  - line_total de cada línea ya viene neto del descuento "cliente especial"
 *    (por producto), calculado al agregar/editar la línea.
 *  - subtotal = suma de line_total (después de descuentos por línea, antes
 *    del descuento de pronto pago).
 *  - descuento de pronto pago = subtotal × % SOLO si está activo Y la
 *    condición de compra es "pago anticipado" (a crédito no aplica).
 *  - IVA se calcula sobre (subtotal − descuento de pronto pago).
 */

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type QuoteItemForTotals = { line_total: number };

export type QuoteTotalsInput = {
  promptPaymentEnabled: boolean;
  promptPaymentPct: number;
  purchaseCondition: "credit" | "prepaid";
  ivaPct: number;
};

export type QuoteTotals = {
  subtotal: number;
  discountTotal: number;
  ivaTotal: number;
  grandTotal: number;
};

export function computeQuoteTotals(
  items: QuoteItemForTotals[],
  opts: QuoteTotalsInput
): QuoteTotals {
  const subtotal = round2(items.reduce((sum, item) => sum + item.line_total, 0));

  const promptPaymentApplies = opts.promptPaymentEnabled && opts.purchaseCondition === "prepaid";
  const discountTotal = promptPaymentApplies
    ? round2(subtotal * (opts.promptPaymentPct / 100))
    : 0;

  const taxableBase = subtotal - discountTotal;
  const ivaTotal = round2(taxableBase * (opts.ivaPct / 100));
  const grandTotal = round2(taxableBase + ivaTotal);

  return { subtotal, discountTotal, ivaTotal, grandTotal };
}

/** Calcula subtotal/descuento/total de UNA línea a partir de sus datos crudos. */
export function computeLineTotals(unitPrice: number, quantityUnits: number, discountPct: number) {
  const lineSubtotal = round2(unitPrice * quantityUnits);
  const discountAmount = round2(lineSubtotal * (discountPct / 100));
  const lineTotal = round2(lineSubtotal - discountAmount);
  return { lineSubtotal, discountAmount, lineTotal };
}
