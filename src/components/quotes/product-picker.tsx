"use client";

import { useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { addItemAction } from "@/app/(app)/quotes/[quoteId]/actions";

type PackageOption = { id: string; units_per_package: number; label: string | null };
type VariantOption = {
  id: string;
  name: string;
  sku: string | null;
  unit_price: number;
  packages: PackageOption[];
};
type ProductOption = {
  id: string;
  name: string;
  company_id: string;
  company_name: string;
  variants: VariantOption[];
};

const selectClass =
  "w-full rounded-xl border border-black/10 bg-white/70 px-3.5 py-2.5 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-white/10 dark:bg-white/5";

export function ProductPicker({
  quoteId,
  products,
}: {
  quoteId: string;
  products: ProductOption[];
}) {
  const companies = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => map.set(p.company_id, p.company_name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [products]);

  const [companyId, setCompanyId] = useState("");
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [quantity, setQuantity] = useState(1);

  const filteredProducts = companyId
    ? products.filter((p) => p.company_id === companyId)
    : products;

  const selectedProduct = filteredProducts.find((p) => p.id === productId) ?? null;
  const selectedVariant = selectedProduct?.variants.find((v) => v.id === variantId) ?? null;
  const selectedPackage = selectedVariant?.packages.find((pk) => pk.id === packageId) ?? null;

  const unitsPerLine = selectedPackage ? selectedPackage.units_per_package * quantity : quantity;
  const previewTotal = selectedVariant ? selectedVariant.unit_price * unitsPerLine : 0;

  function resetSelection() {
    setProductId("");
    setVariantId("");
    setPackageId("");
    setQuantity(1);
  }

  return (
    <GlassCard strong>
      <h2 className="mb-4 text-sm font-medium">Agregar producto</h2>
      <form
        action={addItemAction}
        onSubmit={() => {
          // Deja que el form se envíe; limpiamos la selección visual después
          // de un tick para no pelear con el submit nativo.
          setTimeout(resetSelection, 0);
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <input type="hidden" name="quote_id" value={quoteId} />

        <select
          className={selectClass}
          value={companyId}
          onChange={(e) => {
            setCompanyId(e.target.value);
            resetSelection();
          }}
        >
          <option value="">Todas las empresas</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          className={selectClass}
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value);
            setVariantId("");
            setPackageId("");
          }}
        >
          <option value="">Producto…</option>
          {filteredProducts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.company_name})
            </option>
          ))}
        </select>

        <select
          name="variant_id"
          className={selectClass + " sm:col-span-2"}
          value={variantId}
          onChange={(e) => {
            setVariantId(e.target.value);
            setPackageId("");
          }}
          disabled={!selectedProduct}
        >
          <option value="">Variante…</option>
          {selectedProduct?.variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.sku ? `[${v.sku}] ` : ""}
              {v.name} — ${v.unit_price.toFixed(2)}/unidad
            </option>
          ))}
        </select>

        <select
          name="package_id"
          className={selectClass}
          value={packageId}
          onChange={(e) => setPackageId(e.target.value)}
          disabled={!selectedVariant}
        >
          <option value="">Unidad suelta (sin paquete)</option>
          {selectedVariant?.packages.map((pk) => (
            <option key={pk.id} value={pk.id}>
              {pk.label || `Paquete de ${pk.units_per_package}`} — $
              {(pk.units_per_package * (selectedVariant?.unit_price ?? 0)).toFixed(2)}
            </option>
          ))}
        </select>

        <input
          name="quantity"
          type="number"
          min="1"
          step="1"
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          placeholder={selectedPackage ? "Número de paquetes" : "Cantidad de unidades"}
          className={selectClass}
        />

        <div className="flex items-center justify-between gap-3 sm:col-span-2">
          <p className="text-sm text-[var(--ink-muted)]">
            {selectedVariant ? (
              <>
                {selectedPackage
                  ? `${quantity} paquete(s) × ${selectedPackage.units_per_package} pzas = ${unitsPerLine} unidades`
                  : `${quantity} unidad(es)`}{" "}
                — <span className="font-medium text-[var(--ink)]">${previewTotal.toFixed(2)}</span>
              </>
            ) : (
              "Selecciona un producto para ver el total de la línea."
            )}
          </p>
          <Button type="submit" disabled={!selectedVariant} className="shrink-0">
            Agregar
          </Button>
        </div>
      </form>
    </GlassCard>
  );
}
