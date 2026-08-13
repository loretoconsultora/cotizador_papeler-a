"use server";

import { redirect } from "next/navigation";
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

  redirect(`/quotes/${quote.id}`);
}
