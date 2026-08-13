import Link from "next/link";
import { signOutAction } from "@/lib/auth/actions";
import type { Profile } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

export function TopNav({ profile }: { profile: Profile }) {
  return (
    <header className="glass sticky top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-linear-to-br from-brand-blue to-brand-sky" />
            <span className="font-semibold tracking-tight">
              Cotizador de Papelería
            </span>
          </div>
          <Badge tone={profile.role === "admin" ? "blue" : "sky"}>
            {profile.role === "admin" ? "Administrador" : "Vendedor"}
          </Badge>
          <nav className="flex items-center gap-1 text-sm text-[var(--ink-muted)]">
            <Link
              href="/dashboard"
              className="rounded-full px-3 py-1.5 transition hover:bg-black/5 hover:text-[var(--ink)] dark:hover:bg-white/10"
            >
              Dashboard
            </Link>
            {profile.role === "admin" && (
              <Link
                href="/admin"
                className="rounded-full px-3 py-1.5 transition hover:bg-black/5 hover:text-[var(--ink)] dark:hover:bg-white/10"
              >
                Admin
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-[var(--ink-muted)]">{profile.full_name}</span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-[var(--ink-muted)] transition hover:text-[var(--ink)]"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
