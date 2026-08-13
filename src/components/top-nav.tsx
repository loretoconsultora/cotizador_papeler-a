import { signOutAction } from "@/lib/auth/actions";
import type { Profile } from "@/lib/types";

export function TopNav({ profile }: { profile: Profile }) {
  return (
    <header className="border-b border-neutral-200">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="font-semibold">Cotizador de Papelería</span>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
            {profile.role === "admin" ? "Administrador" : "Vendedor"}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-neutral-500">{profile.full_name}</span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-neutral-500 transition hover:text-neutral-900"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
