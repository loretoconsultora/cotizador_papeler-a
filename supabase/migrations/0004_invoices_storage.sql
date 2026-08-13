-- Bucket privado para las facturas que mandan los proveedores (copia por
-- correo). Convención de ruta: {quote_id}/{company_short_code}-{timestamp}-
-- {nombre_archivo}. Solo el vendedor dueño de la cotización (o el admin)
-- puede subir/ver/borrar, igual criterio que quotes/quote_attachments.

insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

create policy invoices_select on storage.objects for select
  to authenticated
  using (
    bucket_id = 'invoices'
    and (
      is_admin()
      or exists (
        select 1 from quotes q
        where q.id::text = (storage.foldername(name))[1]
        and q.seller_id = auth.uid()
      )
    )
  );

create policy invoices_insert on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'invoices'
    and (
      is_admin()
      or exists (
        select 1 from quotes q
        where q.id::text = (storage.foldername(name))[1]
        and q.seller_id = auth.uid()
      )
    )
  );

create policy invoices_update on storage.objects for update
  to authenticated
  using (
    bucket_id = 'invoices'
    and (
      is_admin()
      or exists (
        select 1 from quotes q
        where q.id::text = (storage.foldername(name))[1]
        and q.seller_id = auth.uid()
      )
    )
  );

create policy invoices_delete on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'invoices'
    and (
      is_admin()
      or exists (
        select 1 from quotes q
        where q.id::text = (storage.foldername(name))[1]
        and q.seller_id = auth.uid()
      )
    )
  );
