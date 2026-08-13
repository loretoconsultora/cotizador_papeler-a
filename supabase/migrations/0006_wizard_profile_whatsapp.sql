-- 0006 — asistente de creación en 4 pasos, perfil editable por el propio
-- vendedor (teléfono/correo de contacto para el PDF), portada de catálogo y
-- bucket para compartir la cotización del cliente por WhatsApp.

-- ============================================================================
-- quotes.confirmed_at — se llena hasta que el vendedor confirma el pedido en
-- el paso 3 del asistente. Antes de eso, la cotización sigue siendo un
-- borrador "en construcción" (aunque ya exista la fila en la base).
-- ============================================================================

alter table quotes add column confirmed_at timestamptz;

-- ============================================================================
-- profiles — teléfono y correo de contacto, editables por el propio
-- vendedor (antes solo el admin podía escribir en "profiles").
-- ============================================================================

alter table profiles add column phone text;
alter table profiles add column contact_email text;

-- Un vendedor ahora puede actualizar su propia fila (nombre, teléfono,
-- correo de contacto) sin pasar por el admin. Para que esto no abra la
-- puerta a que se autoasigne el rol admin o se reactive una cuenta
-- desactivada llamando directo a la API de Supabase, un trigger bloquea
-- cualquier cambio a role/active que no venga de is_admin().
create or replace function prevent_self_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    if new.role is distinct from old.role or new.active is distinct from old.active then
      raise exception 'No tienes permiso para cambiar el rol o el estatus de la cuenta.';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_privileged_fields
  before update on profiles
  for each row execute function prevent_self_privilege_escalation();

drop policy if exists profiles_write on profiles;
create policy profiles_admin_insert on profiles for insert
  to authenticated with check (is_admin());
create policy profiles_admin_delete on profiles for delete
  to authenticated using (is_admin());
create policy profiles_update on profiles for update
  to authenticated using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());

-- ============================================================================
-- company_catalogs.cover_image_path — portada opcional (la puede subir el
-- admin junto con el PDF) para que la sección de catálogos del vendedor no
-- se vea como una lista plana de archivos.
-- ============================================================================

alter table company_catalogs add column cover_image_path text;

-- ============================================================================
-- client-quote-pdfs — bucket público para compartir por WhatsApp la
-- cotización del cliente ya generada (no lleva datos fiscales/transporte,
-- así que el mismo criterio de "público" que company-catalogs aplica).
-- Solo el vendedor dueño de la cotización (o el admin) puede subir/reemplazar.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('client-quote-pdfs', 'client-quote-pdfs', true)
on conflict (id) do nothing;

create policy client_quote_pdfs_insert on storage.objects for insert
  to authenticated with check (
    bucket_id = 'client-quote-pdfs' and (
      is_admin() or exists (
        select 1 from quotes q
        where q.id::text = (storage.foldername(name))[1] and q.seller_id = auth.uid()
      )
    )
  );
create policy client_quote_pdfs_update on storage.objects for update
  to authenticated using (
    bucket_id = 'client-quote-pdfs' and (
      is_admin() or exists (
        select 1 from quotes q
        where q.id::text = (storage.foldername(name))[1] and q.seller_id = auth.uid()
      )
    )
  );
create policy client_quote_pdfs_delete on storage.objects for delete
  to authenticated using (
    bucket_id = 'client-quote-pdfs' and (
      is_admin() or exists (
        select 1 from quotes q
        where q.id::text = (storage.foldername(name))[1] and q.seller_id = auth.uid()
      )
    )
  );
