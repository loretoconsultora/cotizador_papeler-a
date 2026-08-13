import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createProductAction } from "./actions";

type CompanyOption = { id: string; name: string; short_code: string };

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  active: boolean;
  companies: { name: string; short_code: string } | null;
};

export default async function ProductsPage() {
  const supabase = await createClient();

  const [{ data: companiesData }, { data: productsData }] = await Promise.all([
    supabase.from("companies").select("id, name, short_code").order("name"),
    supabase
      .from("products")
      .select("id, sku, name, active, companies(name, short_code)")
      .order("name"),
  ]);

  const companyList = (companiesData ?? []) as CompanyOption[];
  const products = (productsData ?? []) as unknown as ProductRow[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Cada producto pertenece a una empresa. Al crearlo se agrega su
          primera variante — si no maneja variantes reales, deja
          &quot;Único&quot; y ahí queda su precio.
        </p>
      </div>

      {companyList.length === 0 ? (
        <GlassCard className="text-sm text-brand-blue">
          Antes de agregar productos, crea las empresas en{" "}
          <Link href="/admin/catalog/companies" className="underline">
            Catálogo → Empresas
          </Link>
          .
        </GlassCard>
      ) : (
        <GlassCard strong>
          <h2 className="mb-4 text-sm font-medium">Nuevo producto</h2>
          <form action={createProductAction} className="grid gap-4 sm:grid-cols-2">
            <select
              name="company_id"
              required
              defaultValue=""
              className="rounded-xl border border-black/10 bg-white/70 px-3.5 py-2.5 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-white/10 dark:bg-white/5"
            >
              <option value="" disabled>
                Empresa…
              </option>
              {companyList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Input name="sku" placeholder="Clave (SKU)" required />
            <Input
              name="name"
              placeholder="Nombre del producto"
              required
              className="sm:col-span-2"
            />
            <Input
              name="description"
              placeholder="Descripción (opcional)"
              className="sm:col-span-2"
            />
            <Input name="variant_name" placeholder="Nombre de la variante" defaultValue="Único" />
            <Input
              name="unit_price"
              type="number"
              step="0.01"
              min="0"
              placeholder="Precio unitario"
              required
            />
            <Button type="submit" className="w-fit sm:col-span-2">
              Crear producto
            </Button>
          </form>
        </GlassCard>
      )}

      <section className="space-y-3">
        {products.map((p) => (
          <Link key={p.id} href={`/admin/catalog/products/${p.id}`}>
            <GlassCard className="flex items-center justify-between transition hover:bg-white/80">
              <div>
                <span className="font-medium">{p.name}</span>{" "}
                <span className="text-xs text-[var(--ink-muted)]">{p.sku}</span>
              </div>
              <div className="flex items-center gap-2">
                {p.companies && <Badge tone="sky">{p.companies.short_code}</Badge>}
                {!p.active && <Badge tone="neutral">Inactivo</Badge>}
              </div>
            </GlassCard>
          </Link>
        ))}
        {products.length === 0 && (
          <p className="text-sm text-[var(--ink-muted)]">Todavía no hay productos.</p>
        )}
      </section>
    </div>
  );
}
