import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatDate, formatQuantity } from "./format";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: "Helvetica", color: "#1c1c1c" },
  header: { marginBottom: 16, borderBottom: "2 solid #1D94C2", paddingBottom: 10 },
  brand: { fontSize: 16, fontWeight: 700, color: "#1D94C2" },
  subtitle: { fontSize: 9, color: "#6b7280", marginTop: 2 },
  intro: { marginBottom: 12, lineHeight: 1.4 },
  item: { flexDirection: "row", marginBottom: 8 },
  bullet: { width: 14 },
  itemText: { flex: 1 },
  itemTitle: { fontWeight: 700 },
  itemMeta: { color: "#6b7280", fontSize: 9, marginTop: 1 },
});

export type MissingItem = {
  sku: string;
  productName: string;
  variantName: string;
  quantityUnits: number;
  quantityPackages: number | null;
  unitsPerPackage: number | null;
};

export function MissingItemsPdf({
  folio,
  clientName,
  companyName,
  items,
}: {
  folio: string;
  clientName: string;
  companyName: string;
  items: MissingItem[];
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Productos pendientes de surtir</Text>
          <Text style={styles.subtitle}>{formatDate(new Date().toISOString())}</Text>
          <Text style={styles.subtitle}>Folio: {folio}</Text>
        </View>

        <Text style={styles.intro}>
          Estimado(a) {clientName} de {companyName}, los siguientes productos de tu pedido no se
          incluyeron en la factura recibida y quedan pendientes de surtir:
        </Text>

        {items.map((item, idx) => (
          <View key={idx} style={styles.item}>
            <Text style={styles.bullet}>•</Text>
            <View style={styles.itemText}>
              <Text style={styles.itemTitle}>
                {item.sku ? `[${item.sku}] ` : ""}
                {item.productName} — {item.variantName}
              </Text>
              <Text style={styles.itemMeta}>
                {formatQuantity(item.quantityUnits, item.quantityPackages, item.unitsPerPackage)}
              </Text>
            </View>
          </View>
        ))}
      </Page>
    </Document>
  );
}
