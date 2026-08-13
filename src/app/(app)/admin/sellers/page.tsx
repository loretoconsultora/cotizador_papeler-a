import { createClient } from "@/lib/supabase/server";
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
        <h1 className="text-xl font-semibold">Vendedores</h1>
        <p className="text-sm text-neutral-500">
          Alta de cuentas y asignación de empresas por vendedor. Las cuentas se
          crean aquí — no hay registro público.
        </p>
      </div>

      {companyList.length === 0 && (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Todavía no hay empresas dadas de alta en el catálogo — crea primero
          las 3 empresas proveedoras para poder asignarlas a un vendedor.
        </p>
      )}

      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="mb-3 text-sm font-medium">Nuevo vendedor</h2>
        <form action={createSellerAction} className="grid gap-3 sm:grid-cols-2">
          <input
            name="full_name"
            placeholder="Nombre completo"
            required
            className="rounded border border-neutral-300 px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            name="email"
            type="email"
            placeholder="Correo"
            required
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            name="password"
            type="password"
            placeholder="Contraseña temporal"
            required
            minLength={8}
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <fieldset className="sm:col-span-2">
            <legend className="mb-1 text-xs font-medium text-neutral-500">
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
          <button
            type="submit"
            className="w-fit rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white sm:col-span-2"
          >
            Crear vendedor
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Vendedores existentes</h2>
        {sellers.length === 0 && (
          <p className="text-sm text-neutral-400">
            Todavía no hay vendedores dados de alta.
          </p>
        )}
        {sellers.map((seller) => (
          <div key={seller.id} className="rounded-lg border border-neutral-200 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">
                {seller.full_name}
                {!seller.active && (
                  <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                    Inactivo
                  </span>
                )}
              </span>
              <form action={toggleSellerActiveAction}>
                <input type="hidden" name="seller_id" value={seller.id} />
                <input type="hidden" name="active" value={(!seller.active).toString()} />
                <button
                  type="submit"
                  className="text-xs text-neutral-500 hover:text-neutral-900"
                >
                  {seller.active ? "Desactivar" : "Reactivar"}
                </button>
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
              <button
                type="submit"
                className="rounded border border-neutral-300 px-3 py-1 text-xs"
              >
                Guardar empresas
              </button>
            </form>
          </div>
        ))}
      </section>
    </div>
  );
}
