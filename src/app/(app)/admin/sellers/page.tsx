import { createClient } from "@/lib/supabase/server";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  createSellerAction,
  toggleSellerActiveAction,
  updateSellerCompaniesAction,
} from "./actions";

type SellerRow = {
  id: string;
  full_name: string;
  active: boolean;
  company_ids: string[];
};

export default async function SellersPage() {
  const supabase = await createClient();

  const [{ data: companies }, { data: profiles }, { data: matrix }] = await Promise.all([
    supabase.from("companies").select("id, name").order("name"),
    supabase
      .from("profiles")
      .select("id, full_name, active, role")
      .eq("role", "seller")
      .order("full_name"),
    supabase.from("seller_companies").select("seller_id, company_id"),
  ]);

  const companyList = companies ?? [];
  const sellers: SellerRow[] = (profiles ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    active: p.active,
    company_ids: (matrix ?? [])
      .filter((m) => m.seller_id === p.id)
      .map((m) => m.company_id),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vendedores</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Alta de cuentas y asignación de empresas por vendedor. Las cuentas
          se crean aquí — no hay registro público.
        </p>
      </div>

      {companyList.length === 0 && (
        <GlassCard className="border-brand-blue/20 text-sm text-brand-blue">
          Todavía no hay empresas dadas de alta en el catálogo — crea primero
          las 3 empresas proveedoras para poder asignarlas a un vendedor.
        </GlassCard>
      )}

      <GlassCard strong>
        <h2 className="mb-4 text-sm font-medium">Nuevo vendedor</h2>
        <form action={createSellerAction} className="grid gap-4 sm:grid-cols-2">
          <Input name="full_name" placeholder="Nombre completo" required className="sm:col-span-2" />
          <Input name="email" type="email" placeholder="Correo" required />
          <Input
            name="password"
            type="password"
            placeholder="Contraseña temporal"
            required
            minLength={8}
          />
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-xs font-medium text-[var(--ink-muted)]">
              Empresas asignadas
            </legend>
            <div className="flex flex-wrap gap-3">
              {companyList.map((c) => (
                <label key={c.id} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name="company_ids" value={c.id} /> {c.name}
                </label>
              ))}
            </div>
          </fieldset>
          <Button type="submit" className="w-fit sm:col-span-2">
            Crear vendedor
          </Button>
        </form>
      </GlassCard>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-[var(--ink-muted)]">
          Vendedores existentes
        </h2>
        {sellers.length === 0 && (
          <p className="text-sm text-[var(--ink-muted)]">
            Todavía no hay vendedores dados de alta.
          </p>
        )}
        {sellers.map((seller) => (
          <GlassCard key={seller.id}>
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 font-medium">
                {seller.full_name}
                {!seller.active && <Badge tone="neutral">Inactivo</Badge>}
              </span>
              <form action={toggleSellerActiveAction}>
                <input type="hidden" name="seller_id" value={seller.id} />
                <input type="hidden" name="active" value={(!seller.active).toString()} />
                <Button type="submit" variant="ghost" className="px-2 py-1 text-xs">
                  {seller.active ? "Desactivar" : "Reactivar"}
                </Button>
              </form>
            </div>
            <form
              action={updateSellerCompaniesAction}
              className="flex flex-wrap items-center gap-3"
            >
              <input type="hidden" name="seller_id" value={seller.id} />
              {companyList.map((c) => (
                <label key={c.id} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    name="company_ids"
                    value={c.id}
                    defaultChecked={seller.company_ids.includes(c.id)}
                  />{" "}
                  {c.name}
                </label>
              ))}
              <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
                Guardar empresas
              </Button>
            </form>
          </GlassCard>
        ))}
      </section>
    </div>
  );
}
