import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";

export default function AdminHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administración</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Catálogo de productos, gestión de vendedores y estadísticas
          globales.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/admin/sellers">
          <GlassCard className="h-full transition hover:bg-white/80">
            <h2 className="font-medium">Vendedores</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Altas, empresas asignadas y estatus de cuentas.
            </p>
          </GlassCard>
        </Link>
        <Link href="/admin/catalog">
          <GlassCard className="h-full transition hover:bg-white/80">
            <h2 className="font-medium">Catálogo</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Empresas, productos, variantes y paquetes.
            </p>
          </GlassCard>
        </Link>
        <Link href="/admin/stats">
          <GlassCard className="h-full transition hover:bg-white/80">
            <h2 className="font-medium">Estadísticas</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Ganadas/perdidas, por vendedor y por empresa.
            </p>
          </GlassCard>
        </Link>
      </div>
    </div>
  );
}
