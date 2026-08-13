/**
 * Genera un folio legible y prácticamente único sin depender de una
 * secuencia en base de datos (evita condiciones de carrera entre
 * vendedores creando cotizaciones al mismo tiempo).
 * Formato: COT-2026-A1B2C3D4
 */
export function generateFolio(): string {
  const year = new Date().getFullYear();
  const suffix = crypto.randomUUID().split("-")[0].toUpperCase();
  return `COT-${year}-${suffix}`;
}
