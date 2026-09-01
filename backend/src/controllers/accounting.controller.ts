import { z } from 'zod'
import type { Request } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ENGINE_KINDS } from '../domain/types.js'
import { activityBreakdown, ledger, ledgerCsv, vatReturn, zakatReturn } from '../services/accounting.service.js'
import { activityWorkbook, fullWorkbook } from '../services/accountingExport.service.js'
import {
  ingestTransactions,
  listCommissionRates,
  paymentDetail,
  paymentLedger,
  listTransactions,
  reconcile,
  transactionDetail,
  transactionSummary,
  updateCommissionRates,
} from '../services/transactions.service.js'
import { CARD_SCHEMES } from '../domain/commission.js'
import { PAYMENT_METHODS } from '../domain/types.js'
import { TRANSACTION_SOURCES, TRANSACTION_STATUSES } from '../models/index.js'
import type { AccountingScope } from '../interfaces/index.js'

function accountingScope(req: Request): AccountingScope {
  if (!req.auth) throw ApiError.unauthorized()
  return { tenantId: req.auth.tenantId, userId: req.auth.sub }
}

const filterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  engineKind: z.enum(ENGINE_KINDS).optional(),
})

const transactionFilterSchema = filterSchema.extend({
  scheme: z.enum(CARD_SCHEMES).optional(),
  status: z.enum(TRANSACTION_STATUSES).optional(),
  source: z.enum(TRANSACTION_SOURCES).optional(),
  limit: z.coerce.number().int().min(1).max(5000).optional(),
})

const paymentFilterSchema = filterSchema.extend({
  method: z.enum(PAYMENT_METHODS).optional(),
  kind: z.string().optional(),
  scheme: z.enum(CARD_SCHEMES).optional(),
  limit: z.coerce.number().int().min(1).max(5000).optional(),
})

const rateSchema = z.object({
  rates: z.record(z.enum(CARD_SCHEMES), z.number()),
  repriceUnsettled: z.boolean().optional(),
})

const ingestSchema = z.object({
  source: z.enum(TRANSACTION_SOURCES).optional(),
  transactions: z
    .array(
      z.object({
        externalRef: z.string(),
        scheme: z.string(),
        grossAmount: z.number(),
        capturedAt: z.string().optional(),
        terminalId: z.string().optional(),
        maskedPan: z.string().optional(),
        authCode: z.string().optional(),
        currency: z.string().optional(),
        engineKind: z.enum(ENGINE_KINDS).nullable().optional(),
        stationId: z.string().nullable().optional(),
        paymentId: z.string().nullable().optional(),
        bookingId: z.string().nullable().optional(),
        settlementDate: z.string().nullable().optional(),
        status: z.enum(TRANSACTION_STATUSES).optional(),
        source: z.enum(TRANSACTION_SOURCES).optional(),
      }),
    )
    .min(1),
})

export const accountingController = {
  summary: asyncHandler(async (req, res) => {
    const filter = filterSchema.parse(req.query)
    res.json({ success: true, data: await activityBreakdown(accountingScope(req), filter) })
  }),

  vatReturn: asyncHandler(async (req, res) => {
    const filter = filterSchema.parse(req.query)
    res.json({ success: true, data: await vatReturn(accountingScope(req), filter) })
  }),

  zakat: asyncHandler(async (req, res) => {
    const filter = filterSchema.parse(req.query)
    res.json({ success: true, data: await zakatReturn(accountingScope(req), filter) })
  }),

  ledger: asyncHandler(async (req, res) => {
    const filter = filterSchema.parse(req.query)
    res.json({ success: true, data: await ledger(accountingScope(req), filter) })
  }),

  exportActivity: asyncHandler(async (req, res) => {
    const filter = filterSchema.parse(req.query)
    const engineKind = z.enum(ENGINE_KINDS).parse(req.params.engineKind)
    const { buffer, filename } = await activityWorkbook(accountingScope(req), filter, engineKind)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  }),

  exportAll: asyncHandler(async (req, res) => {
    const filter = filterSchema.parse(req.query)
    const { buffer, filename } = await fullWorkbook(accountingScope(req), filter)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  }),

  commissionRates: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listCommissionRates(accountingScope(req)) })
  }),

  updateCommissionRates: asyncHandler(async (req, res) => {
    const input = rateSchema.parse(req.body)
    res.json({ success: true, data: await updateCommissionRates(accountingScope(req), input) })
  }),

  transactions: asyncHandler(async (req, res) => {
    const filter = transactionFilterSchema.parse(req.query)
    res.json({ success: true, data: await listTransactions(accountingScope(req), filter) })
  }),

  transaction: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await transactionDetail(accountingScope(req), req.params.id) })
  }),

  payments: asyncHandler(async (req, res) => {
    const filter = paymentFilterSchema.parse(req.query)
    res.json({ success: true, data: await paymentLedger(accountingScope(req), filter) })
  }),

  payment: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await paymentDetail(accountingScope(req), req.params.id) })
  }),

  transactionSummary: asyncHandler(async (req, res) => {
    const filter = transactionFilterSchema.parse(req.query)
    res.json({ success: true, data: await transactionSummary(accountingScope(req), filter) })
  }),

  ingest: asyncHandler(async (req, res) => {
    const input = ingestSchema.parse(req.body)
    const result = await ingestTransactions(accountingScope(req), input.transactions, input.source ?? 'ETL')
    res.status(201).json({ success: true, data: result })
  }),

  reconciliation: asyncHandler(async (req, res) => {
    const filter = transactionFilterSchema.parse(req.query)
    res.json({ success: true, data: await reconcile(accountingScope(req), filter) })
  }),

  export: asyncHandler(async (req, res) => {
    const filter = filterSchema.parse(req.query)
    const csv = await ledgerCsv(accountingScope(req), filter)
    const stamp = [filter.from ?? 'all', filter.to ?? 'all'].join('_')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="wayz-vat-${stamp}.csv"`)
    res.send(csv)
  }),
}
