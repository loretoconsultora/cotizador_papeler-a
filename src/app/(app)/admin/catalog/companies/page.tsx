import { createClient } from "@/lib/supabase/server";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/confirm-button";
import {
  createCompanyAction,
  toggleCompanyActiveAction,
  uploadCatalogAction,
  deleteCatalogAction,
} from "./actions";

type CompanyRow = {
  id: string;
  name: string;
  short_code: string;
  active: boolean;
};

type CatalogRow = {
  id: string;
  company_id: string;
  file_path: string;
  file_name: string;
  cover_image_path: string | null;
};

export default async function CompaniesPage() {
  const supabase = await createClient();
  const [{ data }, { data: catalogsData }] = await Promise.all([
    supabase.from("companies").select("*").order("name"),
    supabase
      .from("company_catalogs")
      .select("id, company_id, file_path, file_name, cover_image_path")
      .order("created_at", { ascending: false }),
  ]);
  const companies = (data ?? []) as CompanyRow[];
  const catalogs = (catalogsData ?? []) as CatalogRow[];
  const catalogsByCompany = new Map<string, CatalogRow[]>();
  catalogs.forEach((c) => {
    const list = catalogsByCompany.get(c.company_id) ?? [];
    list.push(c);
    catalogsByCompany.set(c.company_id, list);
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Empresas</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Las 3 empresas proveedoras cuyo catálogo se integra en el cotizador.
        </p>
      </div>

      <GlassCard strong>
        <h2 className="mb-4 text-sm font-medium">Nueva empresa</h2>
        <form
          action={createCompanyAction}
          className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end"
        >
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nombre</label>
            <Input name="name" placeholder="Nombre de la empresa" required />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Código</label>
            <Input name="short_code" placeholder="Ej. ABC" required maxLength={10} />
          </div>
          <Button type="submit">Agregar</Button>
        </form>
      </GlassCard>

      <section className="space-y-3">
        {companies.map((c) => (
          <GlassCard key={c.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.name}</span>
                <Badge tone="blue">{c.short_code}</Badge>
                {!c.active && <Badge tone="neutral">Inactiva</Badge>}
              </div>
              <form action={toggleCompanyActiveAction}>
                <input type="hidden" name="company_id" value={c.id} />
                <input type="hidden" name="active" value={(!c.active).toString()} />
                <Button type="submit" variant="ghost" className="px-2 py-1 text-xs">
                  {c.active ? "Desactivar" : "Reactivar"}
                </Button>
              </form>
            </div>

            <div className="rounded-xl border border-black/5 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.02]">
              <p className="mb-2 text-xs font-medium text-[var(--ink-muted)]">
                Catálogo (PDF) — visible para vendedores con esta empresa asignada
              </p>
              <div className="space-y-1.5">
                {(catalogsByCompany.get(c.id) ?? []).map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">{cat.file_name}</span>
                    <form action={deleteCatalogAction}>
                      <input type="hidden" name="catalog_id" value={cat.id} />
                      <input type="hidden" name="file_path" value={cat.file_path} />
                      <ConfirmButton
                        confirmMessage={`¿Eliminar el catálogo "${cat.file_name}"?`}
                        variant="ghost"
                        className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        Eliminar
                      </ConfirmButton>
                    </form>
                  </div>
                ))}
                {(catalogsByCompany.get(c.id) ?? []).length === 0 && (
                  <p className="text-xs text-[var(--ink-muted)]">Sin catálogo cargado todavía.</p>
                )}
              </div>
              <form
                action={uploadCatalogAction}
                className="mt-2 flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="company_id" value={c.id} />
                <div className="space-y-1">
                  <label className="block text-[11px] text-[var(--ink-muted)]">Catálogo (PDF)</label>
                  <input
                    type="file"
                    name="catalog_file"
                    accept="application/pdf"
                    required
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] text-[var(--ink-muted)]">
                    Portada (imagen, opcional)
                  </label>
                  <input type="file" name="cover_image" accept="image/*" className="text-xs" />
                </div>
                <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
                  Subir catálogo
                </Button>
              </form>
            </div>
          </GlassCard>
        ))}
        {companies.length === 0 && (
          <p className="text-sm text-[var(--ink-muted)]">Todavía no hay empresas.</p>
        )}
      </section>
    </div>
  );
}
