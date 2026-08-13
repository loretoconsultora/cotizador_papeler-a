"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/lib/auth/actions";
import type { Profile } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

function Avatar({ url, name, size = 28 }: { url: string | null; name: string; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt={name}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-brand-blue/15 text-xs font-semibold text-brand-blue"
    >
      {initial}
    </span>
  );
}

export function TopNav({ profile, avatarUrl }: { profile: Profile; avatarUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Reportes" },
    { href: "/quotes", label: "Cotizaciones" },
    ...(profile.role === "seller" ? [{ href: "/products", label: "Productos" }] : []),
    { href: "/clients", label: "Clientes" },
    ...(profile.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
    { href: "/profile", label: "Perfil" },
  ];

  function isActive(href: string) {
    return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  }

  return (
    <header className="glass sticky top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex shrink-0 items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-linear-to-br from-brand-blue to-brand-sky" />
            <span className="hidden font-semibold tracking-tight sm:inline">
              Cotizador de Papelería
            </span>
            <span className="font-semibold tracking-tight sm:hidden">Cotizador</span>
          </div>
          <Badge tone={profile.role === "admin" ? "blue" : "sky"} className="hidden sm:inline-flex">
            {profile.role === "admin" ? "Administrador" : "Vendedor"}
          </Badge>
          <nav className="hidden items-center gap-1 text-sm sm:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3 py-1.5 transition ${
                  isActive(l.href)
                    ? "bg-brand-blue/10 font-medium text-brand-blue"
                    : "text-[var(--ink-muted)] hover:bg-black/5 hover:text-[var(--ink)] dark:hover:bg-white/10"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-3 text-sm sm:flex">
          <Avatar url={avatarUrl} name={profile.full_name} />
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

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menú"
          aria-expanded={open}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:bg-black/5 sm:hidden dark:hover:bg-white/10"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-black/5 px-4 pb-4 sm:hidden dark:border-white/10">
          <div className="flex items-center gap-2 pt-3 pb-1">
            <Avatar url={avatarUrl} name={profile.full_name} />
            <Badge tone={profile.role === "admin" ? "blue" : "sky"}>
              {profile.role === "admin" ? "Administrador" : "Vendedor"}
            </Badge>
            <span className="text-sm text-[var(--ink-muted)]">{profile.full_name}</span>
          </div>
          <nav className="flex flex-col gap-1 pt-2 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2 transition ${
                  isActive(l.href)
                    ? "bg-brand-blue/10 font-medium text-brand-blue"
                    : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <form action={signOutAction} className="pt-2">
            <button
              type="submit"
              className="rounded-lg px-3 py-2 text-left text-sm text-[var(--ink-muted)] transition hover:bg-black/5 dark:hover:bg-white/10"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
