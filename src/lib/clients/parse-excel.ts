import ExcelJS from "exceljs";

export type ImportedClient = {
  client_name: string;
  company_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
};

// Encabezados aceptados por columna (minúsculas, sin acentos) — para no
// depender de que el Excel del cliente tenga exactamente estos nombres.
const HEADER_ALIASES: Record<keyof ImportedClient, string[]> = {
  client_name: ["nombre", "cliente", "nombre del cliente", "contacto"],
  company_name: ["empresa", "compania", "nombre de la empresa", "razon social"],
  phone: ["telefono", "tel", "celular"],
  email: ["correo", "email", "correo electronico"],
  address: ["direccion", "domicilio"],
  city: ["ciudad", "municipio", "localidad"],
};

const COMBINING_MARKS = new RegExp("[̀-ͯ]", "g");

function normalize(s: string): string {
  return s.normalize("NFD").replace(COMBINING_MARKS, "").trim().toLowerCase();
}

/**
 * Lee la primera hoja de un .xlsx con clientes previos a la herramienta.
 * Requiere una fila de encabezados (en cualquier orden); solo exige que cada
 * fila tenga al menos nombre o empresa para importarla.
 */
export async function parseClientsExcel(buffer: ArrayBuffer): Promise<ImportedClient[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const columnIndex: Partial<Record<keyof ImportedClient, number>> = {};
  headerRow.eachCell((cell, colNumber) => {
    const value = normalize(String(cell.value ?? ""));
    for (const key of Object.keys(HEADER_ALIASES) as (keyof ImportedClient)[]) {
      if (HEADER_ALIASES[key].includes(value)) columnIndex[key] = colNumber;
    }
  });

  const results: ImportedClient[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const get = (key: keyof ImportedClient) => {
      const idx = columnIndex[key];
      if (!idx) return "";
      const cell = row.getCell(idx);
      return cell.value == null ? "" : String(cell.value).trim();
    };

    const clientName = get("client_name");
    const companyName = get("company_name");
    if (!clientName && !companyName) continue;

    results.push({
      client_name: clientName || companyName,
      company_name: companyName || clientName,
      phone: get("phone") || null,
      email: get("email") || null,
      address: get("address") || null,
      city: get("city") || null,
    });
  }

  return results;
}
