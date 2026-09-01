import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import type { Booking, Order } from '@/api/types'

export interface InvoiceData {
  booking: Booking
  order: Order
  customerName: string
  customerPhone: string
  brandName: string
  currency: string
  qrDataUri: string
  trackingUrl: string
  issuedAt: Date
}

const NAVY = '#0f214a'
const BRAND = '#14b8a6'
const MUTED = '#64748b'
const LINE = '#e2e8f0'

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 40, fontSize: 10, color: NAVY, fontFamily: 'Helvetica' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: NAVY },
  brandRule: { width: 42, height: 3, backgroundColor: BRAND, marginTop: 6 },
  docTitle: { fontSize: 15, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  muted: { color: MUTED },
  small: { fontSize: 9, color: MUTED },
  section: { marginTop: 22 },
  label: { fontSize: 8, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
  twoCol: { flexDirection: 'row', justifyContent: 'space-between', gap: 24 },
  col: { flexGrow: 1, flexBasis: 0 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  tableHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: NAVY, paddingBottom: 5, marginBottom: 5 },
  row: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: LINE },
  cellName: { flexGrow: 1, flexBasis: 0 },
  cellQty: { width: 40, textAlign: 'right' },
  cellAmount: { width: 80, textAlign: 'right' },
  bold: { fontFamily: 'Helvetica-Bold' },
  totals: { marginTop: 10, marginLeft: 'auto', width: 220 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  grandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 7,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: NAVY,
  },
  qrBox: { alignItems: 'center', width: 128 },
  qr: { width: 104, height: 104 },
  bagRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: LINE },
  policy: { marginTop: 18, padding: 10, backgroundColor: '#f8fafc', borderRadius: 4 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: MUTED },
})

const fmtDateTime = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return [h ? `${h}h` : '', m ? `${m}m` : ''].filter(Boolean).join(' ') || '—'
}

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  const { booking, order, currency } = data
  const money = (n: number) => `${n.toFixed(2)} ${currency}`
  const session = booking.session

  return (
    <Document title={`Invoice ${order.ref}`} author={data.brandName} subject={`Invoice for booking ${booking.ref}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>{data.brandName}</Text>
            <View style={styles.brandRule} />
            <Text style={[styles.small, { marginTop: 8 }]}>Booking {booking.ref}</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>INVOICE</Text>
            <Text style={[styles.small, { textAlign: 'right', marginTop: 4 }]}>No. {order.ref}</Text>
            <Text style={[styles.small, { textAlign: 'right' }]}>{fmtDateTime(data.issuedAt)}</Text>
          </View>
        </View>

        <View style={[styles.section, styles.twoCol]}>
          <View style={styles.col}>
            <Text style={styles.label}>Billed to</Text>
            <Text style={styles.bold}>{data.customerName || '—'}</Text>
            {!!data.customerPhone && <Text style={styles.muted}>{data.customerPhone}</Text>}
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Rental</Text>
            <View style={styles.metaRow}>
              <Text style={styles.muted}>Service</Text>
              <Text>{booking.productName}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.muted}>Duration</Text>
              <Text>{durationLabel(session.requestedDurationMin)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.muted}>Starts</Text>
              <Text>{fmtDateTime(session.startedAt)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.muted}>Due back</Text>
              <Text>{fmtDateTime(session.expectedEndAt)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.tableHead}>
            <Text style={[styles.cellName, styles.label, { marginBottom: 0 }]}>Description</Text>
            <Text style={[styles.cellQty, styles.label, { marginBottom: 0 }]}>Qty</Text>
            <Text style={[styles.cellAmount, styles.label, { marginBottom: 0 }]}>Amount</Text>
          </View>
          {order.lines.map((line, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.cellName}>
                {line.name}
                {line.isDeposit ? ' (refundable deposit)' : ''}
              </Text>
              <Text style={styles.cellQty}>{line.quantity}</Text>
              <Text style={styles.cellAmount}>{money(line.unitPrice * line.quantity)}</Text>
            </View>
          ))}

          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.muted}>Subtotal (net)</Text>
              <Text>{money(order.subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.muted}>VAT</Text>
              <Text>{money(order.vat)}</Text>
            </View>
            {order.depositTotal > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.muted}>Refundable deposit</Text>
                <Text>{money(order.depositTotal)}</Text>
              </View>
            )}
            <View style={styles.grandRow}>
              <Text style={styles.bold}>Total</Text>
              <Text style={styles.bold}>{money(order.total)}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.section, styles.twoCol]}>
          <View style={styles.col}>
            <Text style={styles.label}>Items held ({booking.bags.length})</Text>
            {booking.bags.map((bag) => (
              <View key={bag.index} style={styles.bagRow}>
                <Text>Item {bag.index} · {bag.description}</Text>
                <Text style={styles.small}>{bag.status}</Text>
              </View>
            ))}
          </View>
          <View style={styles.qrBox}>
            <Text style={styles.label}>Track your items</Text>
            <Image style={styles.qr} src={data.qrDataUri} />
            <Text style={[styles.small, { textAlign: 'center', marginTop: 5 }]}>Scan to see your live countdown</Text>
          </View>
        </View>

        <View style={styles.policy}>
          <Text style={styles.bold}>Overtime policy</Text>
          <Text style={[styles.muted, { marginTop: 3, lineHeight: 1.4 }]}>
            Collection is due by {fmtDateTime(session.expectedEndAt)}. A grace period of{' '}
            {session.gracePeriodMin} minutes follows at no charge. Beyond the grace period a full hour is charged
            {session.overtimeHourlyRate > 0 ? ` at ${money(session.overtimeHourlyRate)} per hour` : ''}, and each further
            hour begins a new block.
          </Text>
        </View>

        <Text style={styles.footer} fixed>
          {data.trackingUrl}
        </Text>
      </Page>
    </Document>
  )
}
