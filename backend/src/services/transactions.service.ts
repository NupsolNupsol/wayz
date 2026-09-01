import { Booking, CardTransaction, CommissionRate, Expense, Payment, Tenant, User } from '../models/index.js'
import { recordAudit } from './audit.service.js'
import { ApiError } from '../utils/ApiError.js'
import { round2 } from '../utils/helpers.js'
import { nextId } from './counter.service.js'
import { DEFAULT_VAT_RATE, splitInclusive } from '../domain/tax.js'
import {
  CARD_SCHEMES,
  DEFAULT_COMMISSION_RATES,
  MAX_COMMISSION_RATE,
  commissionOn,
  normaliseScheme,
  type CardScheme,
} from '../domain/commission.js'
import { ENGINE_KINDS, type EngineKind } from '../domain/types.js'
import { SCHEME_LABELS } from '../constants/labels.constants.js'

import type { TransactionSource, TransactionStatus } from '../models/index.js'
import type {
  IngestResult,
  RateInput,
  RawTransaction,
  ReconciliationRow,
  TransactionFilter,
} from '../interfaces/index.js'
import type { AccountingScope, PeriodFilter } from '../interfaces/index.js'

const SETTLED_STATUSES: TransactionStatus[] = ['SETTLED']
const CREDIT_STATUSES: TransactionStatus[] = ['REFUNDED', 'REVERSED']

function periodOf(filter: PeriodFilter): { $gte?: Date; $lte?: Date } | undefined {
  const range: { $gte?: Date; $lte?: Date } = {}
  if (filter.from) range.$gte = new Date(filter.from)
  if (filter.to) {
    const to = new Date(filter.to)
    to.setUTCHours(23, 59, 59, 999)
    range.$lte = to
  }
  return Object.keys(range).length ? range : undefined
}

export async function commissionRates(tenantId: string): Promise<Record<CardScheme, number>> {
  const stored = await CommissionRate.find({ tenantId }).lean()
  const rates = { ...DEFAULT_COMMISSION_RATES }
  for (const row of stored) {
    if (CARD_SCHEMES.includes(row.scheme)) rates[row.scheme] = row.rate
  }
  return rates
}

export async function listCommissionRates(scope: AccountingScope) {
  const rates = await commissionRates(scope.tenantId)
  const stored = await CommissionRate.find({ tenantId: scope.tenantId }).lean()
  const byScheme = new Map(stored.map((r) => [r.scheme, r]))

  return CARD_SCHEMES.map((scheme) => ({
    scheme,
    label: SCHEME_LABELS[scheme],
    rate: rates[scheme],
    defaultRate: DEFAULT_COMMISSION_RATES[scheme],
    isDefault: rates[scheme] === DEFAULT_COMMISSION_RATES[scheme],
    updatedAt: byScheme.get(scheme)?.updatedAt ?? null,
    updatedBy: byScheme.get(scheme)?.updatedBy ?? null,
  }))
}

export async function updateCommissionRates(scope: AccountingScope, input: RateInput) {
  const entries = Object.entries(input.rates ?? {}) as [string, number][]
  if (!entries.length) throw ApiError.badRequest('Send at least one rate to change.')

  for (const [scheme, rate] of entries) {
    if (!CARD_SCHEMES.includes(scheme as CardScheme)) throw ApiError.badRequest(`Unknown card scheme "${scheme}".`)
    if (typeof rate !== 'number' || Number.isNaN(rate)) throw ApiError.badRequest(`Give ${scheme} a numeric rate.`)
    if (rate < 0) throw ApiError.badRequest('A commission rate cannot be negative.')
    if (rate > MAX_COMMISSION_RATE) {
      throw ApiError.badRequest(`A commission rate above ${(MAX_COMMISSION_RATE * 100).toFixed(0)}% is not a rate, it is a mistake.`)
    }
  }

  for (const [scheme, rate] of entries) {
    await CommissionRate.findOneAndUpdate(
      { _id: `${scope.tenantId}:${scheme}` },
      { tenantId: scope.tenantId, scheme, rate, updatedBy: scope.userId },
      { upsert: true },
    )
  }

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.userId,
    action: 'COMMISSION_RATES_UPDATED',
    entity: 'CommissionRate',
    entityId: scope.tenantId,
    detail: entries.map(([s, r]) => `${s} ${(r * 100).toFixed(2)}%`).join(', '),
  })

  let repriced = 0
  if (input.repriceUnsettled) repriced = await repriceUnsettled(scope)

  return { rates: await listCommissionRates(scope), repriced }
}

async function repriceUnsettled(scope: AccountingScope): Promise<number> {
  const rates = await commissionRates(scope.tenantId)
  const pending = await CardTransaction.find({
    tenantId: scope.tenantId,
    status: { $nin: SETTLED_STATUSES },
  })

  let changed = 0
  for (const txn of pending) {
    const rate = rates[txn.scheme]
    if (rate === txn.commissionRate) continue
    const split = commissionOn(txn.grossAmount, rate)
    txn.commissionRate = split.commissionRate
    txn.commissionAmount = split.commissionAmount
    txn.netSettled = split.netSettled
    await txn.save()
    changed += 1
  }

  if (changed) await postCommissionExpenses(scope)
  return changed
}

export async function ingestTransactions(
  scope: AccountingScope,
  rows: RawTransaction[],
  source: TransactionSource = 'ETL',
): Promise<IngestResult> {
  if (!Array.isArray(rows) || rows.length === 0) throw ApiError.badRequest('Send at least one transaction.')
  if (rows.length > 5000) throw ApiError.badRequest('Import at most 5000 transactions in one batch.')

  const tenant = await Tenant.findById(scope.tenantId).lean()
  if (!tenant) throw ApiError.notFound('Tenant not found.')
  const vatRate = tenant.vatRate ?? DEFAULT_VAT_RATE
  const rates = await commissionRates(scope.tenantId)

  const batchId = `batch-${Date.now()}`
  const result: IngestResult = {
    batchId,
    received: rows.length,
    imported: 0,
    duplicates: 0,
    rejected: [],
    grossAmount: 0,
    commissionAmount: 0,
    netSettled: 0,
  }

  const existing = new Set(
    (await CardTransaction.find({ tenantId: scope.tenantId }, { externalRef: 1 }).lean()).map((t) => t.externalRef),
  )
  const seenInBatch = new Set<string>()

  for (const row of rows) {
    const externalRef = String(row?.externalRef ?? '').trim()
    if (!externalRef) {
      result.rejected.push({ externalRef: '', reason: 'Every transaction needs a reference from the terminal.' })
      continue
    }
    if (existing.has(externalRef) || seenInBatch.has(externalRef)) {
      result.duplicates += 1
      continue
    }

    const scheme = normaliseScheme(String(row?.scheme ?? ''))
    if (!scheme) {
      result.rejected.push({ externalRef, reason: `Unknown card scheme "${row?.scheme}".` })
      continue
    }

    const grossAmount = round2(Number(row?.grossAmount))
    if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
      result.rejected.push({ externalRef, reason: 'The amount must be a positive number.' })
      continue
    }

    if (row.engineKind && !ENGINE_KINDS.includes(row.engineKind)) {
      result.rejected.push({ externalRef, reason: `Unknown activity "${row.engineKind}".` })
      continue
    }

    const capturedAt = row.capturedAt ? new Date(row.capturedAt) : new Date()
    if (Number.isNaN(capturedAt.getTime())) {
      result.rejected.push({ externalRef, reason: 'The capture date is not a date.' })
      continue
    }

    const split = commissionOn(grossAmount, rates[scheme])
    const tax = splitInclusive(grossAmount, vatRate)

    await CardTransaction.create({
      _id: await nextId('cardTransaction'),
      tenantId: scope.tenantId,
      source: row.source ?? source,
      externalRef,
      terminalId: row.terminalId ?? '',
      scheme,
      maskedPan: row.maskedPan ?? '',
      authCode: row.authCode ?? '',
      currency: row.currency ?? tenant.currency ?? 'SAR',
      grossAmount: split.grossAmount,
      commissionRate: split.commissionRate,
      commissionAmount: split.commissionAmount,
      netSettled: split.netSettled,
      baseAmount: tax.baseAmount,
      vatAmount: tax.vatAmount,
      vatRate: tax.vatRate,
      engineKind: row.engineKind ?? null,
      stationId: row.stationId ?? null,
      paymentId: row.paymentId ?? null,
      bookingId: row.bookingId ?? null,
      capturedAt,
      settlementDate: row.settlementDate ? new Date(row.settlementDate) : null,
      status: row.status ?? 'CAPTURED',
      batchId,
    })

    seenInBatch.add(externalRef)
    result.imported += 1
    result.grossAmount = round2(result.grossAmount + split.grossAmount)
    result.commissionAmount = round2(result.commissionAmount + split.commissionAmount)
    result.netSettled = round2(result.netSettled + split.netSettled)
  }

  if (result.imported) {
    await postCommissionExpenses(scope)
    await recordAudit({
      tenantId: scope.tenantId,
      actorId: scope.userId,
      action: 'CARD_TRANSACTIONS_IMPORTED',
      entity: 'CardTransaction',
      entityId: batchId,
      detail: `${result.imported} of ${result.received} from ${source} · commission ${result.commissionAmount.toFixed(2)}`,
    })
  }

  return result
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export async function postCommissionExpenses(scope: AccountingScope): Promise<number> {
  const transactions = await CardTransaction.find({
    tenantId: scope.tenantId,
    status: { $nin: CREDIT_STATUSES },
  }).lean()

  const grouped = new Map<string, { day: string; scheme: CardScheme; amount: number; count: number }>()
  for (const txn of transactions) {
    const day = dayKey(txn.capturedAt)
    const key = `${day}:${txn.scheme}`
    const bucket = grouped.get(key) ?? { day, scheme: txn.scheme, amount: 0, count: 0 }
    bucket.amount = round2(bucket.amount + txn.commissionAmount)
    bucket.count += 1
    grouped.set(key, bucket)
  }

  const existing = await Expense.find({ tenantId: scope.tenantId, category: 'BANK_COMMISSION' }).lean()
  const byReference = new Map(existing.map((e) => [e.reference, e]))

  let written = 0
  for (const [key, bucket] of grouped) {
    const reference = `comm:${key}`
    const current = byReference.get(reference)
    if (current && current.amount === bucket.amount && current.status === 'RECORDED') continue

    const label = SCHEME_LABELS[bucket.scheme].en
    const payload = {
      tenantId: scope.tenantId,
      category: 'BANK_COMMISSION' as const,
      description: `Bank commission withheld on ${label} · ${bucket.count} transaction${bucket.count === 1 ? '' : 's'}`,
      supplier: 'Acquiring bank',
      reference,
      engineKind: null,
      seasonId: null,
      amount: bucket.amount,
      baseAmount: bucket.amount,
      vatAmount: 0,
      vatRate: 0,
      incurredAt: new Date(`${bucket.day}T12:00:00.000Z`),
      status: 'RECORDED' as const,
      enteredBy: 'system',
    }

    if (current) {
      await Expense.updateOne({ _id: current._id }, { $set: payload })
    } else {
      await Expense.create({ _id: await nextId('expense'), ...payload })
    }
    written += 1
  }

  const live = new Set([...grouped.keys()].map((k) => `comm:${k}`))
  for (const stale of existing) {
    if (!live.has(stale.reference) && stale.status === 'RECORDED') {
      await Expense.updateOne(
        { _id: stale._id },
        { $set: { status: 'VOID', voidReason: 'No card transactions remain for this day and scheme.' } },
      )
      written += 1
    }
  }

  return written
}

const DEFAULT_LIST_LIMIT = 500
const MAX_LIST_LIMIT = 5000

function queryFor(scope: AccountingScope, filter: TransactionFilter): Record<string, unknown> {
  const query: Record<string, unknown> = { tenantId: scope.tenantId }
  const when = periodOf(filter)
  if (when) query.capturedAt = when
  if (filter.scheme) query.scheme = filter.scheme
  if (filter.status) query.status = filter.status
  if (filter.source) query.source = filter.source
  if (filter.engineKind) query.engineKind = filter.engineKind
  return query
}

export async function listTransactions(scope: AccountingScope, filter: TransactionFilter = {}) {
  const limit = Math.min(Math.max(1, filter.limit ?? DEFAULT_LIST_LIMIT), MAX_LIST_LIMIT)
  return CardTransaction.find(queryFor(scope, filter)).sort({ capturedAt: -1 }).limit(limit).lean()
}

async function allTransactions(scope: AccountingScope, filter: TransactionFilter) {
  return CardTransaction.find(queryFor(scope, filter)).sort({ capturedAt: -1 }).limit(MAX_LIST_LIMIT).lean()
}

export async function transactionSummary(scope: AccountingScope, filter: TransactionFilter = {}) {
  const rows = await allTransactions(scope, filter)
  const rates = await commissionRates(scope.tenantId)
  const live = rows.filter((r) => !CREDIT_STATUSES.includes(r.status))
  const credits = rows.filter((r) => CREDIT_STATUSES.includes(r.status))

  const byScheme = CARD_SCHEMES.map((scheme) => {
    const mine = live.filter((r) => r.scheme === scheme)
    const gross = round2(mine.reduce((t, r) => t + r.grossAmount, 0))
    const commission = round2(mine.reduce((t, r) => t + r.commissionAmount, 0))
    return {
      scheme,
      label: SCHEME_LABELS[scheme],
      rate: rates[scheme],
      count: mine.length,
      grossAmount: gross,
      commissionAmount: commission,
      netSettled: round2(gross - commission),
      share: 0,
    }
  })

  const grossAmount = round2(byScheme.reduce((t, s) => t + s.grossAmount, 0))
  const commissionAmount = round2(byScheme.reduce((t, s) => t + s.commissionAmount, 0))
  for (const row of byScheme) {
    row.share = grossAmount > 0 ? round2((row.grossAmount / grossAmount) * 100) : 0
  }

  return {
    from: filter.from ?? null,
    to: filter.to ?? null,
    byScheme,
    totals: {
      count: live.length,
      grossAmount,
      commissionAmount,
      netSettled: round2(grossAmount - commissionAmount),
      effectiveRate: grossAmount > 0 ? round2((commissionAmount / grossAmount) * 10000) / 10000 : 0,
      baseAmount: round2(live.reduce((t, r) => t + r.baseAmount, 0)),
      vatAmount: round2(live.reduce((t, r) => t + r.vatAmount, 0)),
    },
    credits: {
      count: credits.length,
      grossAmount: round2(credits.reduce((t, r) => t + r.grossAmount, 0)),
    },
  }
}

export async function reconcile(scope: AccountingScope, filter: TransactionFilter = {}) {
  const when = periodOf(filter)

  const paymentQuery: Record<string, unknown> = {
    tenantId: scope.tenantId,
    status: 'CAPTURED',
    kind: { $ne: 'REFUND' },
    method: 'CARD',
  }
  if (when) paymentQuery.createdAt = when

  const [transactions, payments] = await Promise.all([
    allTransactions(scope, filter),
    Payment.find(paymentQuery).lean(),
  ])

  const live = transactions.filter((t) => !CREDIT_STATUSES.includes(t.status))
  const byPaymentId = new Map(live.filter((t) => t.paymentId).map((t) => [t.paymentId as string, t]))
  const rows: ReconciliationRow[] = []
  const claimed = new Set<string>()

  for (const payment of payments) {
    const txn = byPaymentId.get(payment._id)
    if (!txn) {
      rows.push({
        externalRef: '',
        transactionId: null,
        paymentId: payment._id,
        scheme: payment.cardScheme ?? null,
        recordedScheme: payment.cardScheme ?? null,
        terminalAmount: null,
        platformAmount: round2(payment.amount),
        difference: round2(-payment.amount),
        status: 'MISSING_AT_TERMINAL',
        capturedAt: payment.createdAt ? new Date(payment.createdAt).toISOString() : null,
      })
      continue
    }

    claimed.add(txn._id)
    const difference = round2(txn.grossAmount - payment.amount)
    const schemeDisagrees = !!payment.cardScheme && payment.cardScheme !== txn.scheme

    rows.push({
      externalRef: txn.externalRef,
      transactionId: txn._id,
      paymentId: payment._id,
      scheme: txn.scheme,
      recordedScheme: payment.cardScheme ?? null,
      terminalAmount: txn.grossAmount,
      platformAmount: round2(payment.amount),
      difference,
      status:
        Math.abs(difference) >= 0.01 ? 'AMOUNT_MISMATCH' : schemeDisagrees ? 'SCHEME_MISMATCH' : 'MATCHED',
      capturedAt: new Date(txn.capturedAt).toISOString(),
    })
  }

  for (const txn of live) {
    if (claimed.has(txn._id)) continue
    rows.push({
      externalRef: txn.externalRef,
      transactionId: txn._id,
      paymentId: txn.paymentId,
      scheme: txn.scheme,
      recordedScheme: null,
      terminalAmount: txn.grossAmount,
      platformAmount: null,
      difference: txn.grossAmount,
      status: 'MISSING_IN_PLATFORM',
      capturedAt: new Date(txn.capturedAt).toISOString(),
    })
  }

  const count = (status: ReconciliationRow['status']) => rows.filter((r) => r.status === status).length

  const exceptions = rows
    .filter((r) => r.status !== 'MATCHED')
    .sort((a, b) => (b.capturedAt ?? '').localeCompare(a.capturedAt ?? ''))
    .slice(0, 500)

  return {
    from: filter.from ?? null,
    to: filter.to ?? null,
    rows: exceptions,
    compared: rows.length,
    totals: {
      terminal: round2(live.reduce((t, r) => t + r.grossAmount, 0)),
      platform: round2(payments.reduce((t, p) => t + p.amount, 0)),
      matched: count('MATCHED'),
      amountMismatch: count('AMOUNT_MISMATCH'),
      schemeMismatch: count('SCHEME_MISMATCH'),
      missingInPlatform: count('MISSING_IN_PLATFORM'),
      missingAtTerminal: count('MISSING_AT_TERMINAL'),
      balanced: rows.every((r) => r.status === 'MATCHED'),
    },
  }
}

export async function transactionDetail(scope: AccountingScope, id: string) {
  const transaction = await CardTransaction.findOne({ _id: id, tenantId: scope.tenantId }).lean()
  if (!transaction) throw ApiError.notFound('Transaction not found.')

  const payment = transaction.paymentId
    ? await Payment.findOne({ _id: transaction.paymentId, tenantId: scope.tenantId }).lean()
    : null
  const booking = payment?.bookingId
    ? await Booking.findOne({ _id: payment.bookingId, tenantId: scope.tenantId }).lean()
    : null

  const schemeAgrees = !payment?.cardScheme || payment.cardScheme === transaction.scheme
  const amountAgrees = !payment || Math.abs(round2(transaction.grossAmount - payment.amount)) < 0.01

  return {
    ...transaction,
    label: SCHEME_LABELS[transaction.scheme],
    payment: payment
      ? {
          _id: payment._id,
          amount: payment.amount,
          method: payment.method,
          cardScheme: payment.cardScheme ?? null,
          kind: payment.kind,
          takenBy: payment.takenBy,
          createdAt: payment.createdAt,
        }
      : null,
    booking: booking ? { _id: booking._id, ref: booking.ref, customerName: booking.customerName } : null,
    reconciliation: {
      matched: !!payment && schemeAgrees && amountAgrees,
      schemeAgrees,
      amountAgrees,
      difference: payment ? round2(transaction.grossAmount - payment.amount) : null,
    },
  }
}

export interface PaymentLedgerFilter extends PeriodFilter {
  method?: string
  kind?: string
  scheme?: CardScheme
  limit?: number
}

export async function paymentLedger(scope: AccountingScope, filter: PaymentLedgerFilter = {}) {
  const query: Record<string, unknown> = { tenantId: scope.tenantId }
  const when = periodOf(filter)
  if (when) query.createdAt = when
  if (filter.method) query.method = filter.method
  if (filter.kind) query.kind = filter.kind
  if (filter.scheme) query.cardScheme = filter.scheme
  if (filter.engineKind) query.engineKind = filter.engineKind

  const limit = Math.min(Math.max(1, filter.limit ?? DEFAULT_LIST_LIMIT), MAX_LIST_LIMIT)
  const payments = await Payment.find(query).sort({ createdAt: -1 }).limit(limit).lean()
  if (!payments.length) return []

  const [bookings, takers, matched] = await Promise.all([
    Booking.find({ _id: { $in: payments.map((p) => p.bookingId).filter(Boolean) as string[] } }).lean(),
    User.find({ _id: { $in: [...new Set(payments.map((p) => p.takenBy).filter(Boolean))] } }).lean(),
    CardTransaction.find({ tenantId: scope.tenantId, paymentId: { $in: payments.map((p) => p._id) } }).lean(),
  ])

  const bookingOf = new Map(bookings.map((b) => [b._id, b]))
  const takerName = new Map(takers.map((u) => [u._id, u.fullName]))
  const txnOf = new Map(matched.map((t) => [t.paymentId as string, t]))

  return payments.map((p) => {
    const booking = p.bookingId ? bookingOf.get(p.bookingId) : undefined
    const txn = txnOf.get(p._id)
    return {
      _id: p._id,
      ref: booking?.ref ?? p._id,
      bookingId: p.bookingId ?? null,
      customerName: booking?.customerName ?? '',
      amount: p.amount,
      baseAmount: p.baseAmount,
      vatAmount: p.vatAmount,
      method: p.method,
      cardScheme: p.cardScheme ?? null,
      kind: p.kind,
      status: p.status,
      engineKind: (p.engineKind as EngineKind) ?? null,
      takenBy: p.takenBy,
      takenByName: takerName.get(p.takenBy) ?? p.takenBy,
      createdAt: p.createdAt,
      transactionId: txn?._id ?? null,
      externalRef: txn?.externalRef ?? null,
    }
  })
}

export async function paymentDetail(scope: AccountingScope, id: string) {
  const payment = await Payment.findOne({ _id: id, tenantId: scope.tenantId }).lean()
  if (!payment) throw ApiError.notFound('Payment not found.')

  const [booking, taker, transaction] = await Promise.all([
    payment.bookingId ? Booking.findOne({ _id: payment.bookingId, tenantId: scope.tenantId }).lean() : null,
    payment.takenBy ? User.findById(payment.takenBy).lean() : null,
    CardTransaction.findOne({ tenantId: scope.tenantId, paymentId: payment._id }).lean(),
  ])

  const schemeAgrees = !payment.cardScheme || !transaction || payment.cardScheme === transaction.scheme
  const amountAgrees = !transaction || Math.abs(round2(transaction.grossAmount - payment.amount)) < 0.01

  return {
    ...payment,
    ref: booking?.ref ?? payment._id,
    customerName: booking?.customerName ?? '',
    takenByName: taker?.fullName ?? payment.takenBy,
    transaction: transaction
      ? {
          _id: transaction._id,
          externalRef: transaction.externalRef,
          scheme: transaction.scheme,
          grossAmount: transaction.grossAmount,
          commissionAmount: transaction.commissionAmount,
          commissionRate: transaction.commissionRate,
          netSettled: transaction.netSettled,
          status: transaction.status,
          capturedAt: transaction.capturedAt,
        }
      : null,
    reconciliation: {
      matched: !!transaction && schemeAgrees && amountAgrees,
      expectedAtTerminal: payment.method === 'CARD' && payment.kind !== 'REFUND',
      schemeAgrees,
      amountAgrees,
      difference: transaction ? round2(transaction.grossAmount - payment.amount) : null,
    },
  }
}
