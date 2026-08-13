# Seeds de catálogo

Datos reales importados de las listas de precios/catálogos que proporcionó el cliente
(Pinos Altos, Dicresa, Arza Plastic). Generados y validados el 2026-08-13 contra un
Postgres real (0001 + 0002 + estos 3 scripts, sin errores).

## Requisito antes de correrlos

Cada script busca la empresa por `short_code` con una subconsulta
(`select id from companies where short_code = '...'`). Primero hay que crear las 3
empresas en **Admin → Catálogo → Empresas** con EXACTAMENTE estos códigos:

| Empresa | short_code |
|---|---|
| Transformadora Pinos Altos | `PALT` |
| Dicresa | `DICR` |
| Arza Plastic | `ARZA` |

Si el código no coincide, las inserciones de `products`/`product_variants` fallan
(la subconsulta no encuentra ninguna fila y `company_id` queda `null`, lo cual viola
`not null`).

## Orden

1. `seed_pinos_altos.sql`
2. `seed_dicresa.sql`
3. `seed_arza_plastic.sql`

Cada uno es independiente del otro (no hay que correrlos en un orden específico entre
sí, solo después de crear las 3 empresas).

## Decisiones tomadas al importar (ver mensaje del 2026-08-13 para el detalle completo)

- Los rollos térmicos/kraft del catálogo "Mark Padruno" se integraron dentro de
  **Pinos Altos** (así aparecen en su propia lista de precios oficial).
- Dicresa no maneja claves — se generaron códigos internos `DIC-001`, `DIC-002`...
- Claves duplicadas dentro de una misma empresa (ej. `ME517` en Pinos Altos para 3
  colores distintos, `GE10`/`FRB10` en Arza) se desambiguaron agregando `-2`, `-3`...
- Precios importados tal cual vienen en la columna "P.U." / "PRECIO U." de cada
  archivo (sin IVA, como indican todas las listas).
