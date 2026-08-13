-- 0007 — ciudad del cliente (para la nueva sección "Clientes"), foto de
-- perfil del vendedor/admin, y bucket para avatares.

alter table clients add column city text;
create index clients_city_idx on clients (lower(city));

alter table profiles add column avatar_path text;

-- Bucket público (foto de perfil, no es información sensible) — el propio
-- usuario sube/reemplaza/borra solo la suya; admin puede gestionar cualquiera.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy avatars_insert on storage.objects for insert
  to authenticated with check (
    bucket_id = 'avatars' and (
      is_admin() or (storage.foldername(name))[1] = auth.uid()::text
    )
  );
create policy avatars_update on storage.objects for update
  to authenticated using (
    bucket_id = 'avatars' and (
      is_admin() or (storage.foldername(name))[1] = auth.uid()::text
    )
  );
create policy avatars_delete on storage.objects for delete
  to authenticated using (
    bucket_id = 'avatars' and (
      is_admin() or (storage.foldername(name))[1] = auth.uid()::text
    )
  );
