"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { uploadCatalogAction, type UploadCatalogState } from "@/app/(app)/admin/catalog/companies/actions";

const initialState: UploadCatalogState = { status: "idle", message: "" };

// Estiliza el input de archivo nativo con un "botón" de color (pseudo-clase
// ::file-selector-button) en vez del enlace gris casi invisible por default.
const fileInputClass =
  "text-xs text-[var(--ink-muted)] file:mr-2 file:rounded-full file:border-0 file:bg-brand-blue file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white file:transition hover:file:brightness-105 cursor-pointer";

export function CatalogUploadForm({ companyId }: { companyId: string }) {
  const [state, formAction, isPending] = useActionState(uploadCatalogAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Al subir con éxito, vacía los dos <input type="file"> para que quede
  // claro que ya se procesó (si no, el navegador sigue mostrando el nombre
  // del archivo y parece que "no pasó nada").
  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="mt-2 space-y-2">
      <input type="hidden" name="company_id" value={companyId} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="block text-[11px] text-[var(--ink-muted)]">Catálogo (PDF)</label>
          <input
            type="file"
            name="catalog_file"
            accept="application/pdf"
            required
            className={fileInputClass}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-[11px] text-[var(--ink-muted)]">Portada (imagen, opcional)</label>
          <input type="file" name="cover_image" accept="image/*" className={fileInputClass} />
        </div>
        <Button type="submit" disabled={isPending} className="px-4 py-2 text-xs">
          {isPending ? "Subiendo…" : "Subir catálogo"}
        </Button>
      </div>
      {state.status === "success" && (
        <p className="text-xs font-medium text-emerald-600">✅ {state.message}</p>
      )}
      {state.status === "error" && <p className="text-xs font-medium text-red-600">⚠️ {state.message}</p>}
    </form>
  );
}
