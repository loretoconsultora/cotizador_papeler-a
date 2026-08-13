import { requireProfile } from "@/lib/auth/require-user";

export default async function DashboardPage() {
  const { profile } = await requireProfile();

  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Hola, {profile.full_name}</h1>
      <p className="text-sm text-neutral-500">
        {profile.role === "admin"
          ? "Panel de administrador — aquí irán los indicadores globales de todas las cotizaciones."
          : "Aquí verás el resumen de tus cotizaciones."}
      </p>
    </div>
  );
}
