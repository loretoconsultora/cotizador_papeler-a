-- Bucket privado para la constancia de situación fiscal de cada cliente.
-- Convención de ruta: {client_id}/{timestamp}-{nombre_archivo}
-- Así storage.foldername(name) devuelve el client_id como primer segmento,
-- y podemos exigir que solo el vendedor dueño del cliente (o el admin) lo
-- suba/lea/borre — mismo criterio que la tabla `clients`.

insert into storage.buckets (id, name, public)
values ('fiscal-docs', 'fiscal-docs', false)
on conflict (id) do nothing;

create policy fiscal_docs_select on storage.objects for select
  to authenticated
  using (
    bucket_id = 'fiscal-docs'
    and (
      is_admin()
      or exists (
        select 1 from clients c
        where c.id::text = (storage.foldername(name))[1]
        and c.created_by = auth.uid()
      )
    )
  );

create policy fiscal_docs_insert on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'fiscal-docs'
    and (
      is_admin()
      or exists (
        select 1 from clients c
        where c.id::text = (storage.foldername(name))[1]
        and c.created_by = auth.uid()
      )
    )
  );

create policy fiscal_docs_update on storage.objects for update
  to authenticated
  using (
    bucket_id = 'fiscal-docs'
    and (
      is_admin()
      or exists (
        select 1 from clients c
        where c.id::text = (storage.foldername(name))[1]
        and c.created_by = auth.uid()
      )
    )
  );

create policy fiscal_docs_delete on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'fiscal-docs'
    and (
      is_admin()
      or exists (
        select 1 from clients c
        where c.id::text = (storage.foldername(name))[1]
        and c.created_by = auth.uid()
      )
    )
  );
