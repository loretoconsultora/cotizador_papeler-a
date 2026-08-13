-- 0005 — archivado/borrado de cotizaciones por el propio vendedor,
-- y catálogos PDF por empresa (para reenviar al cliente por WhatsApp).

-- ============================================================================
-- quotes.archived — ocultar del listado principal sin borrar el historial
-- ============================================================================

alter table quotes add column archived boolean not null default false;
create index quotes_archived_idx on quotes (archived);

-- El vendedor ahora también puede eliminar sus propias cotizaciones (antes
-- solo admin). Se pide confirmación en la UI; el borrado es en cascada sobre
-- quote_items, quote_status_history, quote_attachments, provider_quotes y
-- quote_item_fulfillment (todas con "on delete cascade" desde 0001).
drop policy if exists quotes_delete on quotes;
create policy quotes_delete on quotes for delete
  to authenticated using (seller_id = auth.uid() or is_admin());

-- ============================================================================
-- company_catalogs — catálogos PDF vigentes por empresa, para que cualquier
-- vendedor con esa empresa asignada los tenga a la mano y se los reenvíe al
-- cliente (por WhatsApp) sin tener que pedírselos al admin cada vez.
-- ============================================================================

create table company_catalogs (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  file_path    text not null,
  file_name    text not null,
  uploaded_by  uuid references profiles(id),
  created_at   timestamptz not null default now()
);
create index company_catalogs_company_idx on company_catalogs (company_id);

alter table company_catalogs enable row level security;

-- Mismo criterio que products_select: el vendedor solo ve catálogos de
-- empresas que tiene asignadas; admin ve todos.
create policy company_catalogs_select on company_catalogs for select
  to authenticated using (
    is_admin() or exists (
      select 1 from seller_companies sc
      where sc.seller_id = auth.uid() and sc.company_id = company_catalogs.company_id
    )
  );
create policy company_catalogs_write on company_catalogs for all
  to authenticated using (is_admin()) with check (is_admin());

-- Bucket público: son folletos de venta, no datos sensibles del cliente ni
-- fiscales, así que conviene una URL estable (sin firmar/expirar) para poder
-- compartirla por WhatsApp directamente. Solo el admin puede subir/borrar.
insert into storage.buckets (id, name, public)
values ('company-catalogs', 'company-catalogs', true)
on conflict (id) do nothing;

create policy company_catalogs_storage_insert on storage.objects for insert
  to authenticated with check (bucket_id = 'company-catalogs' and is_admin());
create policy company_catalogs_storage_update on storage.objects for update
  to authenticated using (bucket_id = 'company-catalogs' and is_admin());
create policy company_catalogs_storage_delete on storage.objects for delete
  to authenticated using (bucket_id = 'company-catalogs' and is_admin());
