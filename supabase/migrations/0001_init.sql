-- Cotizador de Papelería — esquema inicial
-- Proyecto Supabase independiente y exclusivo de este repositorio.
--
-- Orden: (1) extensiones y helpers sin dependencias de tablas, (2) TODAS las
-- tablas, (3) is_admin() (ya puede referenciar "profiles"), (4) TODAS las
-- políticas RLS. Las funciones `language sql` se validan contra el catálogo
-- en el momento de crearse, así que is_admin() no puede ir antes de que
-- exista la tabla profiles.

create extension if not exists pgcrypto;

-- ============================================================================
-- Helpers sin dependencias de tablas
-- ============================================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- companies — las 3 empresas proveedoras
-- ============================================================================

create table companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  short_code  text not null unique,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger set_updated_at before update on companies
  for each row execute function set_updated_at();

-- ============================================================================
-- profiles — espejo de auth.users con rol
-- ============================================================================

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        text not null check (role in ('admin', 'seller')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger set_updated_at before update on profiles
  for each row execute function set_updated_at();

-- ============================================================================
-- seller_companies — matriz vendedor ↔ empresa (1, 2 o 3 empresas por vendedor)
-- ============================================================================

create table seller_companies (
  seller_id   uuid not null references profiles(id) on delete cascade,
  company_id  uuid not null references companies(id) on delete cascade,
  primary key (seller_id, company_id)
);

-- ============================================================================
-- products / variants / packages
-- ============================================================================

create table products (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id),
  sku          text not null,
  name         text not null,
  description  text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (company_id, sku)
);
create trigger set_updated_at before update on products
  for each row execute function set_updated_at();

create table product_variants (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references products(id) on delete cascade,
  name         text not null default 'Único',
  unit_price   numeric(12,2) not null check (unit_price >= 0),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger set_updated_at before update on product_variants
  for each row execute function set_updated_at();

create table product_packages (
  id                 uuid primary key default gen_random_uuid(),
  variant_id         uuid not null references product_variants(id) on delete cascade,
  units_per_package  integer not null check (units_per_package > 0),
  label              text,
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);

-- ============================================================================
-- clients — directorio EXCLUSIVO del vendedor que lo creó (admin ve todos)
-- ============================================================================

create table clients (
  id                    uuid primary key default gen_random_uuid(),
  created_by            uuid not null references profiles(id),

  client_name           text not null,
  company_name          text not null,
  phone                 text,
  email                 text,
  address               text,

  -- datos fiscales (se piden/precargan al pasar a "Aprobada")
  rfc                   text,
  tax_regime            text,
  cfdi_use              text,
  fiscal_doc_path       text,

  -- back order: vive en el cliente, no en la cotización individual
  has_active_backorder  boolean not null default false,
  backorder_note        text,
  backorder_opened_at   timestamptz,
  backorder_closed_at   timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger set_updated_at before update on clients
  for each row execute function set_updated_at();
create index clients_created_by_idx on clients (created_by);
create index clients_email_idx on clients (lower(email));
create index clients_company_name_idx on clients (lower(company_name));

-- ============================================================================
-- quotes — entidad central del flujo
-- ============================================================================

create table quotes (
  id             uuid primary key default gen_random_uuid(),
  folio          text not null unique,
  seller_id      uuid not null references profiles(id),
  client_id      uuid references clients(id),

  -- snapshot capturado en el paso 1 (antes de resolver/crear el client definitivo)
  client_name_snapshot   text not null,
  company_name_snapshot  text not null,
  phone_snapshot         text,
  email_snapshot         text,
  address_snapshot       text,

  purchase_condition  text not null check (purchase_condition in ('credit', 'prepaid')),
  payment_method      text not null check (payment_method in ('transfer', 'deposit', 'cash')),

  prompt_payment_enabled  boolean not null default false,
  prompt_payment_pct      numeric(5,2) not null default 5.00,
  special_client_enabled  boolean not null default false,

  subtotal        numeric(12,2) not null default 0,
  discount_total   numeric(12,2) not null default 0,
  iva_pct          numeric(5,2) not null default 16.00,
  iva_total        numeric(12,2) not null default 0,
  grand_total      numeric(12,2) not null default 0,

  -- transporte (capturado junto con fiscales, al pasar a "Aprobada")
  carrier_name             text,
  delivery_type            text check (delivery_type in ('address', 'pickup')),
  delivery_address         text,
  delivery_same_as_client  boolean not null default false,

  -- datos fiscales "congelados" al momento de aprobar (trazabilidad; no cambian si el
  -- cliente actualiza su RFC después)
  rfc_snapshot         text,
  tax_regime_snapshot  text,
  cfdi_use_snapshot    text,

  status   text not null default 'draft'
    check (status in ('draft', 'approved', 'final', 'invoiced', 'ordered', 'closed')),
  outcome  text not null default 'in_progress'
    check (outcome in ('in_progress', 'won', 'lost')),
  lost_reason  text,

  approved_at  timestamptz,
  final_at     timestamptz,
  invoiced_at  timestamptz,
  ordered_at   timestamptz,
  closed_at    timestamptz,
  -- se fijan cuando "outcome" cambia a won/lost; alimentan las estadísticas
  -- mensuales por vendedor (conversión, importe vendido, etc.) con la fecha
  -- real del cambio en vez de aproximarla con created_at/updated_at.
  won_at   timestamptz,
  lost_at  timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger set_updated_at before update on quotes
  for each row execute function set_updated_at();
create index quotes_seller_idx on quotes (seller_id);
create index quotes_client_idx on quotes (client_id);
create index quotes_status_idx on quotes (status);

-- ============================================================================
-- quote_items — líneas de la cotización cliente (fuente única; se filtra por
-- company_id al separar en cotizaciones de proveedor)
-- ============================================================================

create table quote_items (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references quotes(id) on delete cascade,
  company_id  uuid not null references companies(id),
  product_id  uuid not null references products(id),
  variant_id  uuid not null references product_variants(id),
  package_id  uuid references product_packages(id),

  sku_snapshot                 text not null,
  product_name_snapshot        text not null,
  description_snapshot         text,
  variant_name_snapshot        text not null,
  unit_price_snapshot          numeric(12,2) not null,
  units_per_package_snapshot   integer,

  quantity_packages  integer,
  quantity_units     integer not null check (quantity_units > 0),

  line_subtotal     numeric(12,2) not null,
  discount_pct       numeric(5,2) not null default 0,
  discount_amount     numeric(12,2) not null default 0,
  line_total          numeric(12,2) not null,

  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger set_updated_at before update on quote_items
  for each row execute function set_updated_at();
create index quote_items_quote_idx on quote_items (quote_id);
create index quote_items_company_idx on quote_items (quote_id, company_id);

-- ============================================================================
-- quote_status_history — auditoría de transiciones
-- ============================================================================

create table quote_status_history (
  id           uuid primary key default gen_random_uuid(),
  quote_id     uuid not null references quotes(id) on delete cascade,
  from_status  text,
  to_status    text not null,
  changed_by   uuid references profiles(id),
  note         text,
  created_at   timestamptz not null default now()
);

-- ============================================================================
-- quote_attachments — facturas de proveedor (constancia fiscal vive en clients)
-- ============================================================================

create table quote_attachments (
  id           uuid primary key default gen_random_uuid(),
  quote_id     uuid not null references quotes(id) on delete cascade,
  kind         text not null check (kind in ('invoice')),
  company_id   uuid references companies(id),
  file_path    text not null,
  file_name    text not null,
  uploaded_by  uuid references profiles(id),
  created_at   timestamptz not null default now()
);

-- ============================================================================
-- provider_quotes — una por empresa involucrada, generadas en "cotización final"
-- ============================================================================

create table provider_quotes (
  id            uuid primary key default gen_random_uuid(),
  quote_id      uuid not null references quotes(id) on delete cascade,
  company_id    uuid not null references companies(id),
  folio         text not null unique,
  generated_at  timestamptz not null default now(),
  unique (quote_id, company_id)
);

-- ============================================================================
-- quote_item_fulfillment — cotejo ✓/✗ en estatus "Pedido"
-- ============================================================================

create table quote_item_fulfillment (
  id             uuid primary key default gen_random_uuid(),
  quote_item_id  uuid not null unique references quote_items(id) on delete cascade,
  received       boolean,
  checked_by     uuid references profiles(id),
  checked_at     timestamptz,
  note           text
);

-- ============================================================================
-- is_admin() — ahora sí, con "profiles" ya creada.
-- security definer: puede leerse desde cualquier policy sin recursión sobre profiles.
-- ============================================================================

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin' and p.active
  );
$$;

-- ============================================================================
-- RLS — todas las políticas, ahora que existen todas las tablas y is_admin()
-- ============================================================================

alter table companies enable row level security;
create policy companies_select on companies for select
  to authenticated using (true);
create policy companies_write on companies for all
  to authenticated using (is_admin()) with check (is_admin());

alter table profiles enable row level security;
create policy profiles_select on profiles for select
  to authenticated using (id = auth.uid() or is_admin());
-- Solo admin gestiona altas/roles/estatus de cuentas (se crean vía Supabase Admin API).
create policy profiles_write on profiles for all
  to authenticated using (is_admin()) with check (is_admin());

alter table seller_companies enable row level security;
create policy seller_companies_select on seller_companies for select
  to authenticated using (seller_id = auth.uid() or is_admin());
create policy seller_companies_write on seller_companies for all
  to authenticated using (is_admin()) with check (is_admin());

alter table products enable row level security;
alter table product_variants enable row level security;
alter table product_packages enable row level security;

-- Un vendedor solo ve productos de las empresas que tiene asignadas; admin ve todo.
create policy products_select on products for select
  to authenticated using (
    is_admin() or exists (
      select 1 from seller_companies sc
      where sc.seller_id = auth.uid() and sc.company_id = products.company_id
    )
  );
create policy products_write on products for all
  to authenticated using (is_admin()) with check (is_admin());

create policy variants_select on product_variants for select
  to authenticated using (
    is_admin() or exists (
      select 1 from products p
      join seller_companies sc on sc.company_id = p.company_id
      where p.id = product_variants.product_id and sc.seller_id = auth.uid()
    )
  );
create policy variants_write on product_variants for all
  to authenticated using (is_admin()) with check (is_admin());

create policy packages_select on product_packages for select
  to authenticated using (
    is_admin() or exists (
      select 1 from product_variants v
      join products p on p.id = v.product_id
      join seller_companies sc on sc.company_id = p.company_id
      where v.id = product_packages.variant_id and sc.seller_id = auth.uid()
    )
  );
create policy packages_write on product_packages for all
  to authenticated using (is_admin()) with check (is_admin());

alter table clients enable row level security;
create policy clients_select on clients for select
  to authenticated using (created_by = auth.uid() or is_admin());
create policy clients_insert on clients for insert
  to authenticated with check (created_by = auth.uid());
create policy clients_update on clients for update
  to authenticated using (created_by = auth.uid() or is_admin())
  with check (created_by = auth.uid() or is_admin());
create policy clients_delete on clients for delete
  to authenticated using (is_admin());

alter table quotes enable row level security;
create policy quotes_select on quotes for select
  to authenticated using (seller_id = auth.uid() or is_admin());
create policy quotes_insert on quotes for insert
  to authenticated with check (seller_id = auth.uid());
create policy quotes_update on quotes for update
  to authenticated using (seller_id = auth.uid() or is_admin())
  with check (seller_id = auth.uid() or is_admin());
create policy quotes_delete on quotes for delete
  to authenticated using (is_admin());

alter table quote_items enable row level security;
create policy quote_items_select on quote_items for select
  to authenticated using (
    exists (select 1 from quotes q where q.id = quote_items.quote_id
            and (q.seller_id = auth.uid() or is_admin()))
  );
-- Editable en cualquier estatus del flujo (borrador, aprobada, cotización final,
-- factura, pedido) para poder corregir algo que cambió después. Solo se bloquea
-- en 'closed', que representa el ciclo ya cerrado/archivado.
create policy quote_items_insert on quote_items for insert
  to authenticated with check (
    exists (select 1 from quotes q where q.id = quote_items.quote_id
            and q.seller_id = auth.uid() and q.status <> 'closed')
    or is_admin()
  );
create policy quote_items_update on quote_items for update
  to authenticated using (
    exists (select 1 from quotes q where q.id = quote_items.quote_id
            and q.seller_id = auth.uid() and q.status <> 'closed')
    or is_admin()
  )
  with check (
    exists (select 1 from quotes q where q.id = quote_items.quote_id
            and q.seller_id = auth.uid() and q.status <> 'closed')
    or is_admin()
  );
create policy quote_items_delete on quote_items for delete
  to authenticated using (
    exists (select 1 from quotes q where q.id = quote_items.quote_id
            and q.seller_id = auth.uid() and q.status <> 'closed')
    or is_admin()
  );

alter table quote_status_history enable row level security;
create policy quote_status_history_select on quote_status_history for select
  to authenticated using (
    exists (select 1 from quotes q where q.id = quote_status_history.quote_id
            and (q.seller_id = auth.uid() or is_admin()))
  );
create policy quote_status_history_insert on quote_status_history for insert
  to authenticated with check (
    exists (select 1 from quotes q where q.id = quote_status_history.quote_id
            and (q.seller_id = auth.uid() or is_admin()))
  );

alter table quote_attachments enable row level security;
create policy quote_attachments_select on quote_attachments for select
  to authenticated using (
    exists (select 1 from quotes q where q.id = quote_attachments.quote_id
            and (q.seller_id = auth.uid() or is_admin()))
  );
create policy quote_attachments_write on quote_attachments for all
  to authenticated using (
    exists (select 1 from quotes q where q.id = quote_attachments.quote_id
            and (q.seller_id = auth.uid() or is_admin()))
  )
  with check (
    exists (select 1 from quotes q where q.id = quote_attachments.quote_id
            and (q.seller_id = auth.uid() or is_admin()))
  );

alter table provider_quotes enable row level security;
create policy provider_quotes_select on provider_quotes for select
  to authenticated using (
    exists (select 1 from quotes q where q.id = provider_quotes.quote_id
            and (q.seller_id = auth.uid() or is_admin()))
  );
create policy provider_quotes_write on provider_quotes for all
  to authenticated using (
    exists (select 1 from quotes q where q.id = provider_quotes.quote_id
            and (q.seller_id = auth.uid() or is_admin()))
  )
  with check (
    exists (select 1 from quotes q where q.id = provider_quotes.quote_id
            and (q.seller_id = auth.uid() or is_admin()))
  );

alter table quote_item_fulfillment enable row level security;
create policy quote_item_fulfillment_select on quote_item_fulfillment for select
  to authenticated using (
    exists (
      select 1 from quote_items qi join quotes q on q.id = qi.quote_id
      where qi.id = quote_item_fulfillment.quote_item_id
      and (q.seller_id = auth.uid() or is_admin())
    )
  );
create policy quote_item_fulfillment_write on quote_item_fulfillment for all
  to authenticated using (
    exists (
      select 1 from quote_items qi join quotes q on q.id = qi.quote_id
      where qi.id = quote_item_fulfillment.quote_item_id
      and (q.seller_id = auth.uid() or is_admin())
    )
  )
  with check (
    exists (
      select 1 from quote_items qi join quotes q on q.id = qi.quote_id
      where qi.id = quote_item_fulfillment.quote_item_id
      and (q.seller_id = auth.uid() or is_admin())
    )
  );
