import { createClient } from "@/lib/supabase/server";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createCompanyAction, toggleCompanyActiveAction } from "./actions";

type CompanyRow = {
  id: string;
  name: string;
  short_code: string;
  active: boolean;
};

export default async function CompaniesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("*").order("name");
  const companies = (data ?? []) as CompanyRow[];

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
          <GlassCard key={c.id} className="flex items-center justify-between">
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
          </GlassCard>
        ))}
        {companies.length === 0 && (
          <p className="text-sm text-[var(--ink-muted)]">Todavía no hay empresas.</p>
        )}
      </section>
    </div>
  );
}
