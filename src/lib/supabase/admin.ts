import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con la service role key — omite RLS por completo. Uso EXCLUSIVO en
 * código de servidor para operaciones administrativas (alta de vendedores vía
 * Supabase Auth Admin API). Nunca importar desde un Client Component ni
 * exponer esta key al navegador.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
