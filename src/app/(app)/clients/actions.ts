"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/require-user";
import { parseClientsExcel } from "@/lib/clients/parse-excel";

/**
 * Importa clientes previos a la herramienta desde un .xlsx. Cada fila
 * importada queda registrada a nombre de quien la sube (mismo criterio de
 * "exclusivo del vendedor que lo creó" que ya rige el resto de clients) —
 * si lo sube el admin, quedan como clientes del admin, visibles para todos
 * por su acceso global.
 */
export async function importClientsAction(formData: FormData) {
  const { supabase, user } = await requireProfile();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Selecciona un archivo .xlsx.");
  }

  const buffer = await file.arrayBuffer();
  const rows = await parseClientsExcel(buffer);
  if (rows.length === 0) {
    throw new Error(
      "No se encontraron filas válidas. Revisa que la primera fila tenga encabezados (nombre, empresa, teléfono, correo, dirección, ciudad)."
    );
  }

  const inserts = rows.map((r) => ({ ...r, created_by: user.id }));
  const { error } = await supabase.from("clients").insert(inserts);
  if (error) throw new Error(error.message);

  revalidatePath("/clients");
}
