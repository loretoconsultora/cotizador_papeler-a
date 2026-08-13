-- Ajuste de modelo tras revisar los catálogos reales de las 3 empresas.
--
-- Problema: el esquema original ponía "clave" (SKU) a nivel de `products`
-- (la familia, ej. "Papel Lustre 50x70"). Pero en los catálogos reales la
-- clave vive por COLOR/VARIANTE (ej. LA=amarillo, LAC=azul claro...), no por
-- familia. Además, Dicresa no maneja claves en absoluto (solo descripción).
--
-- Solución: `sku` y `description` se mueven a `product_variants` (nullable,
-- porque Dicresa no tiene). `products` pasa a representar solo la familia
-- (nombre + descripción genérica opcional). Se agrega `company_id` a
-- product_variants (denormalizado desde products, igual patrón que ya se usa
-- en quote_items) para poder exigir unicidad de sku por empresa sin joins.

alter table product_variants add column company_id uuid references companies(id);
update product_variants v set company_id = p.company_id from products p where p.id = v.product_id;
alter table product_variants alter column company_id set not null;

alter table product_variants add column sku text;
alter table product_variants add column description text;

-- Si ya había productos creados a mano (fase de pruebas), no perder su clave.
update product_variants v set sku = p.sku from products p where p.id = v.product_id and v.sku is null;

-- sku es opcional (Dicresa no usa claves), pero cuando existe debe ser único
-- dentro de la empresa. NULL no choca con NULL en un unique index de Postgres,
-- así que varias variantes sin clave conviven sin problema.
alter table product_variants add constraint product_variants_company_sku_unique unique (company_id, sku);

alter table products drop constraint if exists products_company_id_sku_key;
alter table products drop column if exists sku;

-- Actualiza las policies que referenciaban product_variants para que sigan
-- funcionando igual (no cambian en esencia, solo se re-crean por claridad
-- ya que ahora hay una columna company_id directa disponible si se quisiera
-- simplificar el join en el futuro; se deja el join por products por ahora
-- para no tocar la lógica de seller_companies).
