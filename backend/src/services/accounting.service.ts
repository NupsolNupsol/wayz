import { Booking, CashMovement, Expense, Payment, Tenant } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { round2 } from '../utils/helpers.js'
import {
  DEFAULT_VAT_RATE,
  DEFAULT_ZAKAT_RATE,
  zakatAssessment,
  zatcaReturn,
  } from '../domain/tax.js'
import { ENGINE_KINDS, type EngineKind } from '../domain/types.js'
import { ACTIVITY_LABELS } from '../constants/labels.constants.js'
import type {
  AccountingScope,
  ActivityFigures,
  LedgerRow,
  PeriodFilter,
  VatReturn,
  ZakatReport,
} from '../interfaces/index.js'

function period(filter: PeriodFilter): { $gte?: Date; $lte?: Date } | undefined {
  const range: { $gte?: Date; $lte?: Date } = {}
  if (filter.from) range.$gte = new Date(filter.from)
  if (filter.to) {
    const to = new Date(filter.to)
    to.setUTCHours(23, 59, 59, 999)
    range.$lte = to
  }
  return Object.keys(range).length ? range : undefined
}

async function vatRateFor(tenantId: string): Promise<number> {
  const tenant = await Tenant.findById(tenantId).lean()
  if (!tenant) throw ApiError.notFound('Tenant not found.')
  return tenant.vatRate ?? DEFAULT_VAT_RATE
}

interface Buckets {
  salesBase: number
  salesVat: number
  salesTotal: number
  returnsBase: number
  returnsVat: number
  returnsTotal: number
  purchasesBase: number
  purchasesVat: number
  purchasesTotal: number
}

const emptyBuckets = (): Buckets => ({
  salesBase: 0,
  salesVat: 0,
  salesTotal: 0,
  returnsBase: 0,
  returnsVat: 0,
  returnsTotal: 0,
  purchasesBase: 0,
  purchasesVat: 0,
  purchasesTotal: 0,
})

export async function activityBreakdown(scope: AccountingScope, filter: PeriodFilter) {
  const vatRate = await vatRateFor(scope.tenantId)
  const when = period(filter)

  const paymentQuery: Record<string, unknown> = { tenantId: scope.tenantId, status: { $in: ['CAPTURED', 'REFUNDED'] } }
  if (when) paymentQuery.createdAt = when
  if (filter.engineKind) paymentQuery.engineKind = filter.engineKind

  const movementQuery: Record<string, unknown> = { tenantId: scope.tenantId, kind: 'PAY_OUT' }
  if (when) movementQuery.createdAt = when

  const expenseQuery: Record<string, unknown> = { tenantId: scope.tenantId, status: 'RECORDED' }
  if (when) expenseQuery.incurredAt = when
  if (filter.engineKind) expenseQuery.engineKind = filter.engineKind

  const [payments, movements, expenses] = await Promise.all([
    Payment.find(paymentQuery).lean(),
    filter.engineKind ? [] : CashMovement.find(movementQuery).lean(),
    Expense.find(expenseQuery).lean(),
  ])

  const byActivity = new Map<EngineKind, Buckets>()
  const bucket = (k: EngineKind) => {
    if (!byActivity.has(k)) byActivity.set(k, emptyBuckets())
    return byActivity.get(k)!
  }

  for (const p of payments) {
    const key = (p.engineKind as EngineKind) ?? 'SHOP_AND_DROP'
    const b = bucket(key)
    if (p.kind === 'REFUND') {
      b.returnsBase += p.baseAmount
      b.returnsVat += p.vatAmount
      b.returnsTotal += p.amount
    } else {
      b.salesBase += p.baseAmount
      b.salesVat += p.vatAmount
      b.salesTotal += p.amount
    }
  }

  let purchasesBase = 0
  let purchasesVat = 0
  let purchasesTotal = 0
  for (const m of movements) {
    purchasesBase += m.baseAmount
    purchasesVat += m.vatAmount
    purchasesTotal += m.amount
  }
  for (const e of expenses) {
    purchasesBase += e.baseAmount
    purchasesVat += e.vatAmount
    purchasesTotal += e.amount
  }

  const activities: ActivityFigures[] = ENGINE_KINDS.filter(
    (k) => byActivity.has(k) || !filter.engineKind || filter.engineKind === k,
  ).map(
    (engineKind) => {
      const b = byActivity.get(engineKind) ?? emptyBuckets()
      return {
        engineKind,
        label: ACTIVITY_LABELS[engineKind],
        salesBase: round2(b.salesBase),
        salesVat: round2(b.salesVat),
        salesTotal: round2(b.salesTotal),
        returnsBase: round2(b.returnsBase),
        returnsVat: round2(b.returnsVat),
        returnsTotal: round2(b.returnsTotal),
        netBase: round2(b.salesBase - b.returnsBase),
      }
    },
  )

  const totals = activities.reduce(
    (acc, a) => ({
      salesBase: acc.salesBase + a.salesBase,
      salesVat: acc.salesVat + a.salesVat,
      salesTotal: acc.salesTotal + a.salesTotal,
      returnsBase: acc.returnsBase + a.returnsBase,
      returnsVat: acc.returnsVat + a.returnsVat,
      returnsTotal: acc.returnsTotal + a.returnsTotal,
    }),
    { salesBase: 0, salesVat: 0, salesTotal: 0, returnsBase: 0, returnsVat: 0, returnsTotal: 0 },
  )

  return {
    vatRate,
    from: filter.from ?? null,
    to: filter.to ?? null,
    activities,
    purchases: {
      base: round2(purchasesBase),
      vat: round2(purchasesVat),
      total: round2(purchasesTotal),
    },
    totals: {
      salesBase: round2(totals.salesBase),
      salesVat: round2(totals.salesVat),
      salesTotal: round2(totals.salesTotal),
      returnsBase: round2(totals.returnsBase),
      returnsVat: round2(totals.returnsVat),
      returnsTotal: round2(totals.returnsTotal),
    },
  }
}

export async function vatReturn(scope: AccountingScope, filter: PeriodFilter): Promise<VatReturn> {
  const breakdown = await activityBreakdown(scope, filter)

  const figures = zatcaReturn({
    salesBase: breakdown.totals.salesBase,
    returnsBase: breakdown.totals.returnsBase,
    purchasesBase: breakdown.purchases.base,
    salesVat: breakdown.totals.salesVat,
    returnsVat: breakdown.totals.returnsVat,
    purchasesVat: breakdown.purchases.vat,
    vatRate: breakdown.vatRate,
  })

  return {
    ...figures,
    from: breakdown.from,
    to: breakdown.to,
    activities: breakdown.activities,
  }
}

export async function zakatReturn(scope: AccountingScope, filter: PeriodFilter): Promise<ZakatReport> {
  const [breakdown, vat, tenant] = await Promise.all([
    activityBreakdown(scope, filter),
    vatReturn(scope, filter),
    Tenant.findById(scope.tenantId).lean(),
  ])

  const assessment = zakatAssessment({
    salesBase: breakdown.totals.salesBase,
    returnsBase: breakdown.totals.returnsBase,
    costsBase: breakdown.purchases.base,
    vatPaid: vat.dueVat,
    zakatRate: tenant?.zakatRate ?? DEFAULT_ZAKAT_RATE,
  })

  return { ...assessment, from: breakdown.from, to: breakdown.to, vatDue: vat.dueVat }
}

export async function ledger(scope: AccountingScope, filter: PeriodFilter): Promise<LedgerRow[]> {
  const when = period(filter)

  const paymentQuery: Record<string, unknown> = { tenantId: scope.tenantId, status: { $in: ['CAPTURED', 'REFUNDED'] } }
  if (when) paymentQuery.createdAt = when
  if (filter.engineKind) paymentQuery.engineKind = filter.engineKind

  const movementQuery: Record<string, unknown> = { tenantId: scope.tenantId, kind: 'PAY_OUT' }
  if (when) movementQuery.createdAt = when

  const expenseQuery: Record<string, unknown> = { tenantId: scope.tenantId, status: 'RECORDED' }
  if (when) expenseQuery.incurredAt = when
  if (filter.engineKind) expenseQuery.engineKind = filter.engineKind

  const [payments, movements, expenses] = await Promise.all([
    Payment.find(paymentQuery).sort({ createdAt: 1 }).limit(5000).lean(),
    filter.engineKind ? [] : CashMovement.find(movementQuery).sort({ createdAt: 1 }).limit(5000).lean(),
    Expense.find(expenseQuery).sort({ incurredAt: 1 }).limit(5000).lean(),
  ])

  const bookingIds = [...new Set(payments.map((p) => p.bookingId).filter(Boolean) as string[])]
  const bookings = await Booking.find({ _id: { $in: bookingIds } }).lean()
  const bookingById = new Map(bookings.map((b) => [b._id, b]))

  const rows: LedgerRow[] = []

  for (const p of payments) {
    const b = p.bookingId ? bookingById.get(p.bookingId) : undefined
    const engineKind = (p.engineKind as EngineKind) ?? null
    rows.push({
      date: p.createdAt,
      processType: p.kind === 'REFUND' ? 'مرتجع' : p.method === 'CASH' ? 'مبيعات نقدية' : 'تسوية نقاط البيع',
      details: b ? `${b.productName} — ${b.customerName || 'Walk-in'}` : p.method,
      reference: b?.ref ?? p._id,
      baseAmount: p.baseAmount,
      vatAmount: p.vatAmount,
      totalAmount: p.amount,
      engineKind,
      activity: engineKind ? ACTIVITY_LABELS[engineKind].ar : '',
      entryType: p.kind === 'REFUND' ? 'RETURN' : 'SALE',
    })
  }

  for (const m of movements) {
    rows.push({
      date: m.createdAt,
      processType: 'مصروفات',
      details: m.reason,
      reference: m.reference || m._id,
      baseAmount: m.baseAmount,
      vatAmount: m.vatAmount,
      totalAmount: m.amount,
      engineKind: null,
      activity: '',
      entryType: 'EXPENSE',
    })
  }

  for (const e of expenses) {
    const engineKind = (e.engineKind as EngineKind) ?? null
    rows.push({
      date: e.incurredAt,
      processType:
        e.category === 'PAYROLL'
          ? 'أجور ورواتب'
          : e.category === 'BANK_COMMISSION'
            ? 'عمولة بنكية'
            : 'مشتريات ومصروفات',
      details: e.supplier ? `${e.description} — ${e.supplier}` : e.description,
      reference: e.reference || e._id,
      baseAmount: e.baseAmount,
      vatAmount: e.vatAmount,
      totalAmount: e.amount,
      engineKind,
      activity: engineKind ? ACTIVITY_LABELS[engineKind].ar : '',
      entryType: 'EXPENSE',
    })
  }

  return rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

const BOM = String.fromCharCode(0xfeff)

const CSV_HEADERS = [
  'التاريخ / Date',
  'نوع العملية / Process Type',
  'التفاصيل / Details',
  'رقم المرجع / Reference',
  'الفعالية / Activity',
  'المبيعات بدون ضريبة / Base Amount',
  'الضريبة / VAT Amount',
  'شاملة الضريبة / Total',
]

function csvCell(value: string | number): string {
  const text = String(value ?? '')
  const risky = /^[=+\-@\t\r]/.test(text)
  const escaped = (risky ? `'${text}` : text).replaceAll('"', '""')
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
}

export async function ledgerCsv(scope: AccountingScope, filter: PeriodFilter): Promise<string> {
  const [rows, summary] = await Promise.all([ledger(scope, filter), vatReturn(scope, filter)])

  const lines = [CSV_HEADERS.join(',')]

  for (const r of rows) {
    lines.push(
      [
        new Date(r.date).toISOString().slice(0, 10),
        r.processType,
        r.details,
        r.reference,
        r.activity,
        r.baseAmount.toFixed(2),
        r.vatAmount.toFixed(2),
        r.totalAmount.toFixed(2),
      ]
        .map(csvCell)
        .join(','),
    )
  }

  lines.push('')
  lines.push(['', 'اجمالي المبيعات بدون ضريبة', '', '', '', summary.salesBase.toFixed(2), summary.salesVat.toFixed(2), ''].map(csvCell).join(','))
  lines.push(['', 'اجمالي المرتجعات بدون ضريبة', '', '', '', summary.returnsBase.toFixed(2), summary.returnsVat.toFixed(2), ''].map(csvCell).join(','))
  lines.push(
    ['', 'اجمالي المشتريات والمصروفات بدون ضريبة', '', '', '', summary.purchasesBase.toFixed(2), summary.purchasesVat.toFixed(2), ''].map(csvCell).join(','),
  )
  lines.push(
    ['', 'صافي الوعاء الضريبي / Net taxable base', '', '', '', summary.netTaxableBase.toFixed(2), summary.dueVat.toFixed(2), ''].map(csvCell).join(','),
  )

  return BOM + lines.join('\r\n') + '\r\n'
}
