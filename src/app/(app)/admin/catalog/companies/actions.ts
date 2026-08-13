"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function createCompanyAction(formData: FormData) {
  await requireRole("admin");

  const name = String(formData.get("name") ?? "").trim();
  const shortCode = String(formData.get("short_code") ?? "")
    .trim()
    .toUpperCase();

  if (!name || !shortCode) {
    throw new Error("Nombre y código son obligatorios.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("companies").insert({ name, short_code: shortCode });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/catalog/companies");
  // El selector de empresas en Vendedores y Productos depende de esta tabla.
  revalidatePath("/admin/sellers");
  revalidatePath("/admin/catalog/products");
}

export async function toggleCompanyActiveAction(formData: FormData) {
  await requireRole("admin");

  const companyId = String(formData.get("company_id") ?? "");
  const nextActive = formData.get("active") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ active: nextActive })
    .eq("id", companyId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/catalog/companies");
}

export type UploadCatalogState = {
  status: "idle" | "success" | "error";
  message: string;
};

/**
 * Sube un catálogo PDF (obligatorio) y opcionalmente una imagen de portada
 * para esa empresa — la portada es lo que ve el vendedor en /products antes
 * de abrir el PDF. Se puede llamar varias veces por empresa: cada llamada
 * agrega un catálogo más a la lista, no reemplaza los anteriores.
 *
 * Devuelve un estado (en vez de solo lanzar el error) para que el formulario
 * del cliente pueda mostrar "✓ subido" o el motivo del error sin recargar
 * la página ni depender de que el usuario note un cambio silencioso.
 */
export async function uploadCatalogAction(
  _prevState: UploadCatalogState,
  formData: FormData
): Promise<UploadCatalogState> {
  try {
    const { supabase, user } = await requireRole("admin");

    const companyId = String(formData.get("company_id") ?? "");
    const file = formData.get("catalog_file");
    const coverFile = formData.get("cover_image");
    if (!companyId) throw new Error("Falta la empresa.");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Selecciona un archivo de catálogo.");
    }

    const path = `${companyId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("company-catalogs")
      .upload(path, file, { upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    let coverImagePath: string | null = null;
    if (coverFile instanceof File && coverFile.size > 0) {
      coverImagePath = `${companyId}/cover-${Date.now()}-${coverFile.name}`;
      const { error: coverError } = await supabase.storage
        .from("company-catalogs")
        .upload(coverImagePath, coverFile, { upsert: false });
      if (coverError) throw new Error(coverError.message);
    }

    const { error: insertError } = await supabase.from("company_catalogs").insert({
      company_id: companyId,
      file_path: path,
      file_name: file.name,
      cover_image_path: coverImagePath,
      uploaded_by: user.id,
    });
    if (insertError) throw new Error(insertError.message);

    revalidatePath("/admin/catalog/companies");
    revalidatePath("/products");

    return {
      status: "success",
      message: coverImagePath ? "Catálogo y portada subidos." : "Catálogo subido.",
    };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "No se pudo subir." };
  }
}

export async function deleteCatalogAction(formData: FormData) {
  await requireRole("admin");
  const catalogId = String(formData.get("catalog_id") ?? "");
  const filePath = String(formData.get("file_path") ?? "");
  if (!catalogId) throw new Error("Falta el catálogo.");

  const supabase = await createClient();
  await supabase.storage.from("company-catalogs").remove([filePath]);
  const { error } = await supabase.from("company_catalogs").delete().eq("id", catalogId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/catalog/companies");
  revalidatePath("/products");
}
