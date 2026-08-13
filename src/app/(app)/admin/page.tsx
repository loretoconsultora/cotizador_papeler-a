import Link from "next/link";

export default function AdminHomePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Administración</h1>
        <p className="text-sm text-neutral-500">
          Catálogo de productos, gestión de vendedores y estadísticas
          globales.
        </p>
      </div>
      <nav className="flex flex-wrap gap-3">
        <Link
          href="/admin/sellers"
          className="rounded border border-neutral-300 px-4 py-2 text-sm"
        >
          Vendedores
        </Link>
        <span className="rounded border border-dashed border-neutral-200 px-4 py-2 text-sm text-neutral-400">
          Catálogo (próximamente)
        </span>
        <span className="rounded border border-dashed border-neutral-200 px-4 py-2 text-sm text-neutral-400">
          Estadísticas (próximamente)
        </span>
      </nav>
    </div>
  );
}
