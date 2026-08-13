"use server";

import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

export async function approveQuoteAction(formData: FormData) {
  const { supabase, user } = await requireProfile();

  const quoteId = String(formData.get("quote_id") ?? "");
  if (!quoteId) throw new Error("Falta la cotización.");

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select(
      "id, status, client_name_snapshot, company_name_snapshot, address_snapshot, phone_snapshot, email_snapshot"
    )
    .eq("id", quoteId)
    .single();
  if (quoteError || !quote) throw new Error("Cotización no encontrada.");
  if (quote.status !== "draft") {
    throw new Error("Esta cotización ya no está en borrador.");
  }

  const existingClientId = String(formData.get("existing_client_id") ?? "") || null;
  const rfc = String(formData.get("rfc") ?? "").trim().toUpperCase();
  const taxRegime = String(formData.get("tax_regime") ?? "").trim();
  const cfdiUse = String(formData.get("cfdi_use") ?? "").trim();

  if (!rfc || !taxRegime || !cfdiUse) {
    throw new Error("RFC, régimen fiscal y uso de CFDI son obligatorios.");
  }

  const carrierName = String(formData.get("carrier_name") ?? "").trim();
  const deliveryType = String(formData.get("delivery_type") ?? "address") as "address" | "pickup";
  const deliverySameAsClient = formData.get("delivery_same_as_client") === "on";
  const deliveryAddress =
    deliveryType === "pickup"
      ? null
      : deliverySameAsClient
        ? quote.address_snapshot
        : String(formData.get("delivery_address") ?? "").trim() || null;

  if (!carrierName) throw new Error("Falta el nombre de la empresa transportista.");
  if (deliveryType === "address" && !deliveryAddress) {
    throw new Error("Falta la dirección de entrega.");
  }

  const clientPayload = {
    client_name: quote.client_name_snapshot,
    company_name: quote.company_name_snapshot,
    rfc,
    tax_regime: taxRegime,
    cfdi_use: cfdiUse,
  };

  let clientId = existingClientId;

  if (clientId) {
    const { error } = await supabase
      .from("clients")
      .update({
        client_name: clientPayload.client_name,
        company_name: clientPayload.company_name,
        rfc,
        tax_regime: taxRegime,
        cfdi_use: cfdiUse,
      })
      .eq("id", clientId);
    if (error) throw new Error(error.message);
  } else {
    const { data: newClient, error } = await supabase
      .from("clients")
      .insert({
        created_by: user.id,
        client_name: clientPayload.client_name,
        company_name: clientPayload.company_name,
        phone: quote.phone_snapshot,
        email: quote.email_snapshot,
        address: quote.address_snapshot,
        rfc,
        tax_regime: taxRegime,
        cfdi_use: cfdiUse,
      })
      .select("id")
      .single();
    if (error || !newClient) throw new Error(error?.message ?? "No se pudo crear el cliente.");
    clientId = newClient.id;
  }

  const fiscalDoc = formData.get("fiscal_doc");
  if (fiscalDoc instanceof File && fiscalDoc.size > 0) {
    const path = `${clientId}/${Date.now()}-${fiscalDoc.name}`;
    const { error: uploadError } = await supabase.storage
      .from("fiscal-docs")
      .upload(path, fiscalDoc, { upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { error: docUpdateError } = await supabase
      .from("clients")
      .update({ fiscal_doc_path: path })
      .eq("id", clientId);
    if (docUpdateError) throw new Error(docUpdateError.message);
  }

  const { error: quoteUpdateError } = await supabase
    .from("quotes")
    .update({
      client_id: clientId,
      rfc_snapshot: rfc,
      tax_regime_snapshot: taxRegime,
      cfdi_use_snapshot: cfdiUse,
      carrier_name: carrierName,
      delivery_type: deliveryType,
      delivery_address: deliveryAddress,
      delivery_same_as_client: deliverySameAsClient,
      status: "approved",
      approved_at: new Date().toISOString(),
    })
    .eq("id", quoteId);
  if (quoteUpdateError) throw new Error(quoteUpdateError.message);

  await supabase.from("quote_status_history").insert({
    quote_id: quoteId,
    from_status: "draft",
    to_status: "approved",
    changed_by: user.id,
  });

  redirect(`/quotes/${quoteId}`);
}
