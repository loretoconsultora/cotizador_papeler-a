export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatQuantity(
  quantityUnits: number,
  quantityPackages: number | null,
  unitsPerPackage: number | null
): string {
  if (quantityPackages && unitsPerPackage) {
    return `${quantityPackages} paquete(s) × ${unitsPerPackage} pzas`;
  }
  return `${quantityUnits} unidad(es)`;
}
