# Cotizador de Papelería

Herramienta interna de cotización para el equipo de ventas. Integra el catálogo de
**tres empresas proveedoras** distintas en un solo flujo de cotización, y separa
automáticamente la cotización final por proveedor cuando es momento de enviarla a cada
empresa.

Proyecto **independiente** — sin relación de código, base de datos ni despliegue con
`paginawebloreto` o `IMEF`.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- Supabase (Postgres + Auth + Storage) — proyecto propio, ver `.env.example`
- `@react-pdf/renderer` para la generación de PDFs (cotización cliente, cotización por
  proveedor, listado de faltantes)
- Despliegue: Vercel, integración nativa con GitHub (auto-deploy en push a `main`)

## Desarrollo

```bash
npm install
npm run dev
```

Copia `.env.example` a `.env.local` y completa las credenciales del proyecto de
Supabase de este repositorio (no compartir con otros proyectos).
