import { requireProfile } from "@/lib/auth/require-user";
import { GlassCard } from "@/components/ui/glass-card";

export default async function DashboardPage() {
  const { profile } = await requireProfile();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola, {profile.full_name}
        </h1>
        <p className="text-sm text-[var(--ink-muted)]">
          {profile.role === "admin"
            ? "Panel de administrador."
            : "Resumen de tu actividad."}
        </p>
      </div>

      <GlassCard>
        <p className="text-sm text-[var(--ink-muted)]">
          {profile.role === "admin"
            ? "Aquí irán los indicadores globales de todas las cotizaciones (ganadas/perdidas, por vendedor, por empresa)."
            : "Aquí verás tus KPIs mensuales: cotizaciones, clientes ganados, importe vendido, % de conversión, ticket promedio y % de crecimiento vs. el mes anterior."}
        </p>
      </GlassCard>
    </div>
  );
}
