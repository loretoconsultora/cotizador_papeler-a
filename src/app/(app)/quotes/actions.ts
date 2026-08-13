"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { generateFolio } from "@/lib/quotes/folio";

/** Crea una cotización en borrador vacía y va directo a llenarla. */
export async function createQuoteAction() {
  const { supabase, user } = await requireProfile();

  const { data: quote, error } = await supabase
    .from("quotes")
    .insert({
      folio: generateFolio(),
      seller_id: user.id,
      client_name_snapshot: "",
      company_name_snapshot: "",
      purchase_condition: "credit",
      payment_method: "transfer",
    })
    .select("id")
    .single();

  if (error || !quote) {
    throw new Error(error?.message ?? "No se pudo crear la cotización.");
  }

  redirect(`/quotes/${quote.id}/new`);
}

export type ClientMatch = {
  id: string;
  phone: string | null;
  email: string | null;
  address: string | null;
};

/**
 * Busca (dentro de los clientes del propio vendedor — así lo scopea RLS) un
 * cliente ya registrado cuyo nombre o empresa coincidan exactamente
 * (ignorando mayúsculas/minúsculas) con lo que se está capturando, para
 * precargar teléfono/correo/dirección. Se llama desde un componente cliente
 * en el blur de esos campos, no como acción de formulario.
 */
export async function searchClientMatchAction(
  clientName: string,
  companyName: string
): Promise<ClientMatch | null> {
  const { supabase } = await requireProfile();
  const name = clientName.trim();
  const company = companyName.trim();
  if (!name && !company) return null;

  const [byName, byCompany] = await Promise.all([
    name
      ? supabase.from("clients").select("id, phone, email, address").ilike("client_name", name).limit(1)
      : Promise.resolve({ data: [] as ClientMatch[] }),
    company
      ? supabase.from("clients").select("id, phone, email, address").ilike("company_name", company).limit(1)
      : Promise.resolve({ data: [] as ClientMatch[] }),
  ]);

  return (byName.data?.[0] ?? byCompany.data?.[0] ?? null) as ClientMatch | null;
}

/** Oculta la cotización del listado principal sin borrar nada. Reversible. */
export async function archiveQuoteAction(formData: FormData) {
  const { supabase } = await requireProfile();
  const quoteId = String(formData.get("quote_id") ?? "");
  if (!quoteId) throw new Error("Falta la cotización.");

  const { error } = await supabase.from("quotes").update({ archived: true }).eq("id", quoteId);
  if (error) throw new Error(error.message);

  revalidatePath("/quotes");
}

export async function unarchiveQuoteAction(formData: FormData) {
  const { supabase } = await requireProfile();
  const quoteId = String(formData.get("quote_id") ?? "");
  if (!quoteId) throw new Error("Falta la cotización.");

  const { error } = await supabase.from("quotes").update({ archived: false }).eq("id", quoteId);
  if (error) throw new Error(error.message);

  revalidatePath("/quotes");
}

/**
 * Borrado definitivo (la UI pide confirmación antes de enviar). En cascada
 * se llevan también quote_items, historial de estatus, adjuntos de factura,
 * cotizaciones de proveedor y cotejo — todas con "on delete cascade".
 */
export async function deleteQuoteAction(formData: FormData) {
  const { supabase } = await requireProfile();
  const quoteId = String(formData.get("quote_id") ?? "");
  if (!quoteId) throw new Error("Falta la cotización.");

  const { error } = await supabase.from("quotes").delete().eq("id", quoteId);
  if (error) throw new Error(error.message);

  revalidatePath("/quotes");
  revalidatePath("/dashboard");
}
