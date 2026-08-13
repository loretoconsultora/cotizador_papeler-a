import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/require-user";
import type { Role } from "@/lib/types";

/**
 * Exige un rol específico además de sesión activa. Si el usuario autenticado
 * no tiene ese rol, lo regresa a /dashboard en vez de mostrar un error —
 * evita exponer que la ruta existe a quien no debería verla.
 */
export async function requireRole(role: Role) {
  const ctx = await requireProfile();

  if (ctx.profile.role !== role) {
    redirect("/dashboard");
  }

  return ctx;
}
