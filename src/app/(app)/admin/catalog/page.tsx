import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";

export default function CatalogHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Catálogo</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Empresas, productos, variantes y paquetes.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/admin/catalog/companies">
          <GlassCard className="h-full transition hover:bg-white/80">
            <h2 className="font-medium">Empresas</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Las 3 empresas proveedoras.
            </p>
          </GlassCard>
        </Link>
        <Link href="/admin/catalog/products">
          <GlassCard className="h-full transition hover:bg-white/80">
            <h2 className="font-medium">Productos</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Productos, variantes y paquetes por empresa.
            </p>
          </GlassCard>
        </Link>
      </div>
    </div>
  );
}
