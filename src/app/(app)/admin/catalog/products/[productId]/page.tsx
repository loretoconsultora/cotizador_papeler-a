import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  addPackageAction,
  addVariantAction,
  togglePackageActiveAction,
  toggleVariantActiveAction,
} from "./actions";

type ProductDetail = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  company_id: string;
  companies: { name: string; short_code: string } | null;
};

type PackageRow = {
  id: string;
  units_per_package: number;
  label: string | null;
  active: boolean;
};

type VariantRow = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  unit_price: number;
  active: boolean;
  product_packages: PackageRow[];
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const supabase = await createClient();

  const { data: productData } = await supabase
    .from("products")
    .select("id, name, description, active, company_id, companies(name, short_code)")
    .eq("id", productId)
    .single();

  if (!productData) notFound();
  const product = productData as unknown as ProductDetail;

  const { data: variantsData } = await supabase
    .from("product_variants")
    .select(
      "id, name, sku, description, unit_price, active, product_packages(id, units_per_package, label, active)"
    )
    .eq("product_id", productId)
    .order("created_at");

  const variants = (variantsData ?? []) as unknown as VariantRow[];

  return (
    <div className="space-y-8">
      <div>
        <p className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
          {product.companies && <Badge tone="sky">{product.companies.short_code}</Badge>}
          Familia de producto
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
        {product.description && (
          <p className="mt-1 text-sm text-[var(--ink-muted)]">{product.description}</p>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-[var(--ink-muted)]">Variantes y paquetes</h2>
        {variants.map((variant) => (
          <GlassCard key={variant.id}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {variant.sku && <Badge tone="blue">{variant.sku}</Badge>}
                <span className="font-medium">{variant.name}</span>
                <span className="text-sm text-[var(--ink-muted)]">
                  ${variant.unit_price.toFixed(2)} / unidad
                </span>
                {!variant.active && <Badge tone="neutral">Inactiva</Badge>}
              </div>
              <form action={toggleVariantActiveAction}>
                <input type="hidden" name="variant_id" value={variant.id} />
                <input type="hidden" name="product_id" value={productId} />
                <input type="hidden" name="active" value={(!variant.active).toString()} />
                <Button type="submit" variant="ghost" className="px-2 py-1 text-xs">
                  {variant.active ? "Desactivar" : "Reactivar"}
                </Button>
              </form>
            </div>
            {variant.description && (
              <p className="mb-3 text-xs text-[var(--ink-muted)]">{variant.description}</p>
            )}

            <div className="space-y-3 border-t border-black/5 pt-3 dark:border-white/10">
              <p className="text-xs font-medium text-[var(--ink-muted)]">
                Paquetes (precio = precio unitario × piezas)
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {variant.product_packages.map((pkg) => (
                  <span key={pkg.id} className="flex items-center gap-1">
                    <Badge tone={pkg.active ? "green" : "neutral"}>
                      {pkg.label || `Paquete de ${pkg.units_per_package}`} — $
                      {(variant.unit_price * pkg.units_per_package).toFixed(2)}
                    </Badge>
                    <form action={togglePackageActiveAction}>
                      <input type="hidden" name="package_id" value={pkg.id} />
                      <input type="hidden" name="product_id" value={productId} />
                      <input type="hidden" name="active" value={(!pkg.active).toString()} />
                      <button
                        type="submit"
                        className="text-xs text-[var(--ink-muted)] hover:text-[var(--ink)]"
                        title={pkg.active ? "Desactivar paquete" : "Reactivar paquete"}
                      >
                        {pkg.active ? "✕" : "↺"}
                      </button>
                    </form>
                  </span>
                ))}
                {variant.product_packages.length === 0 && (
                  <span className="text-xs text-[var(--ink-muted)]">
                    Sin paquetes — se vende por unidad suelta.
                  </span>
                )}
              </div>
              <form action={addPackageAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="variant_id" value={variant.id} />
                <input type="hidden" name="product_id" value={productId} />
                <Input
                  name="units_per_package"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Piezas"
                  required
                  className="w-24"
                />
                <Input name="label" placeholder="Etiqueta (opcional)" className="w-48" />
                <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
                  Agregar paquete
                </Button>
              </form>
            </div>
          </GlassCard>
        ))}
      </section>

      <GlassCard strong>
        <h2 className="mb-3 text-sm font-medium">Nueva variante</h2>
        <form action={addVariantAction} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="product_id" value={productId} />
          <input type="hidden" name="company_id" value={product.company_id} />
          <Input name="name" placeholder="Nombre (ej. color)" required />
          <Input name="sku" placeholder="Clave (opcional)" />
          <Input name="description" placeholder="Descripción específica (opcional)" className="sm:col-span-2" />
          <Input
            name="unit_price"
            type="number"
            step="0.01"
            min="0"
            placeholder="Precio unitario"
            required
          />
          <Button type="submit" className="w-fit">
            Agregar variante
          </Button>
        </form>
      </GlassCard>
    </div>
  );
}
