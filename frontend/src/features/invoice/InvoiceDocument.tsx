import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import type { Invoice } from '@/api/invoice.api'

export interface InvoiceData {
  invoice: Invoice
  qrDataUri?: string
  trackingUrl?: string
}

const ROLL_WIDTH = 226.8

const BLACK = '#000000'
const GREY = '#555555'

const styles = StyleSheet.create({
  page: { paddingTop: 14, paddingBottom: 18, paddingHorizontal: 11, fontSize: 8, color: BLACK, fontFamily: 'Helvetica' },
  centre: { textAlign: 'center' },
  legal: { fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  brand: { fontSize: 8, textAlign: 'center', color: GREY },
  reg: { fontSize: 7, textAlign: 'center', color: GREY },
  title: { fontSize: 9, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginTop: 6, marginBottom: 4 },
  rule: { borderBottomWidth: 0.5, borderBottomColor: GREY, borderBottomStyle: 'dashed', marginVertical: 5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  label: { color: GREY },
  bold: { fontFamily: 'Helvetica-Bold' },
  head: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: BLACK, paddingBottom: 2, marginBottom: 3 },
  line: { flexDirection: 'row', marginBottom: 2 },
  cNo: { width: 12 },
  cName: { flexGrow: 1, flexBasis: 0, paddingRight: 4 },
  cQty: { width: 20, textAlign: 'right' },
  cAmt: { width: 44, textAlign: 'right' },
  total: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: BLACK, paddingTop: 3, marginTop: 3 },
  qr: { width: 70, height: 70, alignSelf: 'center', marginTop: 6 },
  footer: { textAlign: 'center', fontSize: 7, color: GREY, marginTop: 6 },
})

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  const { invoice } = data
  const money = (n: number) => `${n.toFixed(2)} ${invoice.seller.currency}`

  return (
    <Document title={`Invoice ${invoice.number}`} author={invoice.seller.name} subject={`Sales invoice ${invoice.number}`}>
      <Page size={{ width: ROLL_WIDTH }} style={styles.page}>
        <Text style={styles.legal}>{invoice.seller.legalName}</Text>
        <Text style={styles.brand}>{invoice.seller.name}</Text>
        <Text style={styles.reg}>CR: {invoice.seller.crNumber}</Text>
        <Text style={styles.reg}>VAT: {invoice.seller.vatNumber}</Text>
        <Text style={styles.title}>SALES INVOICE</Text>

        <View style={styles.rule} />

        <View style={styles.row}>
          <Text style={styles.label}>Invoice no.</Text>
          <Text style={styles.bold}>{invoice.number}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date</Text>
          <Text>{invoice.issuedAt.slice(0, 10)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Branch</Text>
          <Text>{invoice.branch}</Text>
        </View>
        {!!invoice.desk && (
          <View style={styles.row}>
            <Text style={styles.label}>Desk</Text>
            <Text>{invoice.desk}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Served by</Text>
          <Text>{invoice.servedBy}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Customer</Text>
          <Text>{invoice.customer.name || '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Mobile</Text>
          <Text>{invoice.customer.phone || '—'}</Text>
        </View>

        <View style={styles.rule} />

        <View style={styles.head}>
          <Text style={[styles.cNo, styles.label]}>#</Text>
          <Text style={[styles.cName, styles.label]}>Item</Text>
          <Text style={[styles.cQty, styles.label]}>Qty</Text>
          <Text style={[styles.cAmt, styles.label]}>Price</Text>
        </View>
        {invoice.lines.map((line) => (
          <View key={line.index} style={styles.line}>
            <Text style={styles.cNo}>{line.index}</Text>
            <Text style={styles.cName}>
              {line.name}
              {line.isDeposit ? ' (deposit)' : ''}
              {line.kind === 'OVERTIME' ? ' [OVERTIME]' : ''}
              {line.kind === 'PENALTY' ? ' [PENALTY]' : ''}
              {line.kind === 'DELIVERY' ? ' (delivery)' : ''}
            </Text>
            <Text style={styles.cQty}>{line.quantity}</Text>
            <Text style={styles.cAmt}>{line.total.toFixed(2)}</Text>
          </View>
        ))}

        <View style={styles.rule} />

        <Text style={[styles.bold, { marginBottom: 3 }]}>Payment methods</Text>
        {invoice.payments.length === 0 ? (
          <Text style={styles.label}>Not paid yet.</Text>
        ) : (
          invoice.payments.map((p) => (
            <View key={p.label.en} style={styles.row}>
              <Text>{p.label.en}</Text>
              <Text>{money(p.amount)}</Text>
            </View>
          ))
        )}

        <View style={styles.rule} />

        <View style={styles.row}>
          <Text style={styles.label}>Amount before VAT</Text>
          <Text>{money(invoice.totals.base)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>VAT {Math.round(invoice.totals.vatRate * 100)}%</Text>
          <Text>{money(invoice.totals.vat)}</Text>
        </View>
        {invoice.totals.deposit > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>Refundable deposit</Text>
            <Text>{money(invoice.totals.deposit)}</Text>
          </View>
        )}
        <View style={styles.total}>
          <Text style={styles.bold}>Total</Text>
          <Text style={styles.bold}>{money(invoice.totals.total)}</Text>
        </View>

        {!!data.qrDataUri && <Image style={styles.qr} src={data.qrDataUri} />}

        <Text style={[styles.centre, { marginTop: 6 }]}>{invoice.barcode}</Text>
        <Text style={styles.footer}>Thank you for your custom</Text>
        <Text style={styles.footer}>This invoice is subject to the company&apos;s terms and conditions</Text>
        {!!data.trackingUrl && <Text style={styles.footer}>{data.trackingUrl}</Text>}
      </Page>
    </Document>
  )
}
