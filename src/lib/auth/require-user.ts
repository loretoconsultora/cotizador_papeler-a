import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/**
 * Exige una sesión activa. Redirige a /login si no hay usuario autenticado.
 * Usar solo en Server Components / Route Handlers / Server Actions.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

/**
 * Igual que requireUser, pero además carga el perfil (rol, estado activo).
 * Si el perfil no existe o está desactivado, cierra la sesión efectivamente
 * (redirige a /login) — cubre el caso de una cuenta dada de baja por el admin.
 */
export async function requireProfile() {
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile || !profile.active) {
    redirect("/login");
  }

  return { supabase, user, profile };
}
