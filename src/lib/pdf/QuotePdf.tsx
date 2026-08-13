import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatCurrency, formatDate, formatQuantity } from "./format";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#1c1c1c" },
  header: { marginBottom: 16, borderBottom: "2 solid #1D94C2", paddingBottom: 10 },
  brand: { fontSize: 16, fontWeight: 700, color: "#1D94C2" },
  subtitle: { fontSize: 9, color: "#6b7280", marginTop: 2 },
  folio: { fontSize: 9, color: "#6b7280", marginTop: 4 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 9, fontWeight: 700, color: "#6b7280", marginBottom: 4, textTransform: "uppercase" },
  row: { flexDirection: "row", marginBottom: 2 },
  label: { width: 90, color: "#6b7280" },
  value: { flex: 1 },
  table: { marginTop: 6, borderTop: "1 solid #e5e7eb" },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f5f7f9",
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontWeight: 700,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottom: "1 solid #e5e7eb",
  },
  colCompany: { width: 36 },
  colSku: { width: 55 },
  colDesc: { flex: 1 },
  colQty: { width: 110 },
  colPrice: { width: 55, textAlign: "right" },
  colTotal: { width: 60, textAlign: "right" },
  totals: { marginTop: 12, alignItems: "flex-end" },
  totalsBox: { width: 220 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  totalsLabel: { color: "#6b7280" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "1 solid #1c1c1c",
    marginTop: 4,
    paddingTop: 4,
    fontWeight: 700,
    fontSize: 12,
  },
  notice: {
    marginTop: 12,
    padding: 8,
    backgroundColor: "#fef3c7",
    fontSize: 9,
    color: "#92400e",
  },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#9ca3af" },
});

export type QuotePdfItem = {
  companyShortCode: string;
  sku: string;
  productName: string;
  variantName: string;
  quantityUnits: number;
  quantityPackages: number | null;
  unitsPerPackage: number | null;
  unitPrice: number;
  lineTotal: number;
};

export type QuotePdfProps = {
  audience: "client" | "provider";
  folio: string;
  createdAt: string;
  clientName: string;
  companyName: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  paymentMethodLabel: string;
  purchaseConditionLabel: string;
  showCashNotice: boolean;
  items: QuotePdfItem[];

  // Solo audience === "client"
  clientTotals?: {
    subtotal: number;
    discountTotal: number;
    ivaPct: number;
    ivaTotal: number;
    grandTotal: number;
  };

  // Solo audience === "provider"
  providerCompanyName?: string;
  rfc?: string | null;
  taxRegime?: string | null;
  cfdiUse?: string | null;
  carrierName?: string | null;
  deliveryLabel?: string | null;
  providerSubtotal?: number;
};

export function QuotePdf(props: QuotePdfProps) {
  const isClient = props.audience === "client";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>
            {isClient ? "Cotización" : `Cotización a proveedor — ${props.providerCompanyName ?? ""}`}
          </Text>
          <Text style={styles.subtitle}>{formatDate(props.createdAt)}</Text>
          <Text style={styles.folio}>Folio: {props.folio}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cliente</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nombre</Text>
            <Text style={styles.value}>{props.clientName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Empresa</Text>
            <Text style={styles.value}>{props.companyName}</Text>
          </View>
          {!isClient && (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>Teléfono</Text>
                <Text style={styles.value}>{props.phone || "—"}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Correo</Text>
                <Text style={styles.value}>{props.email || "—"}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Dirección</Text>
                <Text style={styles.value}>{props.address || "—"}</Text>
              </View>
            </>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Condición</Text>
            <Text style={styles.value}>{props.purchaseConditionLabel}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Forma de pago</Text>
            <Text style={styles.value}>{props.paymentMethodLabel}</Text>
          </View>
        </View>

        {!isClient && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Datos fiscales</Text>
            <View style={styles.row}>
              <Text style={styles.label}>RFC</Text>
              <Text style={styles.value}>{props.rfc || "—"}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Régimen fiscal</Text>
              <Text style={styles.value}>{props.taxRegime || "—"}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Uso de CFDI</Text>
              <Text style={styles.value}>{props.cfdiUse || "—"}</Text>
            </View>
          </View>
        )}

        {!isClient && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transporte (a cargo del cliente)</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Transportista</Text>
              <Text style={styles.value}>{props.carrierName || "—"}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Entrega</Text>
              <Text style={styles.value}>{props.deliveryLabel || "—"}</Text>
            </View>
          </View>
        )}

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            {isClient && <Text style={styles.colCompany}>Prov.</Text>}
            <Text style={styles.colSku}>Clave</Text>
            <Text style={styles.colDesc}>Producto</Text>
            <Text style={styles.colQty}>Cantidad</Text>
            <Text style={styles.colPrice}>P.U.</Text>
            <Text style={styles.colTotal}>Importe</Text>
          </View>
          {props.items.map((item, idx) => (
            <View key={idx} style={styles.tableRow}>
              {isClient && <Text style={styles.colCompany}>{item.companyShortCode}</Text>}
              <Text style={styles.colSku}>{item.sku || "—"}</Text>
              <Text style={styles.colDesc}>
                {item.productName} — {item.variantName}
              </Text>
              <Text style={styles.colQty}>
                {formatQuantity(item.quantityUnits, item.quantityPackages, item.unitsPerPackage)}
              </Text>
              <Text style={styles.colPrice}>{formatCurrency(item.unitPrice)}</Text>
              <Text style={styles.colTotal}>{formatCurrency(item.lineTotal)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsBox}>
            {isClient && props.clientTotals ? (
              <>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Subtotal</Text>
                  <Text>{formatCurrency(props.clientTotals.subtotal)}</Text>
                </View>
                {props.clientTotals.discountTotal > 0 && (
                  <View style={styles.totalsRow}>
                    <Text style={styles.totalsLabel}>Descuento pronto pago</Text>
                    <Text>-{formatCurrency(props.clientTotals.discountTotal)}</Text>
                  </View>
                )}
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>IVA ({props.clientTotals.ivaPct}%)</Text>
                  <Text>{formatCurrency(props.clientTotals.ivaTotal)}</Text>
                </View>
                <View style={styles.grandTotalRow}>
                  <Text>Total</Text>
                  <Text>{formatCurrency(props.clientTotals.grandTotal)}</Text>
                </View>
              </>
            ) : (
              <View style={styles.grandTotalRow}>
                <Text>Subtotal de esta cotización</Text>
                <Text>{formatCurrency(props.providerSubtotal ?? 0)}</Text>
              </View>
            )}
          </View>
        </View>

        {props.showCashNotice && (
          <Text style={styles.notice}>
            Pago en efectivo — contra entrega en las oficinas de la Ciudad de México.
          </Text>
        )}

        <Text style={styles.footer} fixed>
          Generado por el cotizador interno — {formatDate(new Date().toISOString())}
        </Text>
      </Page>
    </Document>
  );
}
