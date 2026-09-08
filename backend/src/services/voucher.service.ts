import { customAlphabet } from 'nanoid'
import { ApiError } from '../utils/ApiError.js'
import { Voucher, VoucherCampaign } from '../models/voucher.model.js'
import type { VoucherCampaignDoc } from '../models/voucher.model.js'
import { Booking } from '../models/booking.model.js'
import { recordAudit } from './audit.service.js'
import { discountBooking } from './booking.service.js'
import { ENGINE_KINDS } from '../domain/types.js'
import type { EngineKind } from '../domain/types.js'
import type { ManagerScope, Scope } from '../interfaces/index.js'

/** No O/0 or I/1: a code is read off paper by someone in a hurry. */
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const codeBody = customAlphabet(CODE_ALPHABET, 6)

/** One press of "create" mints a batch; this is the ceiling on a single press. */
export const MAX_BATCH = 5000

export const VOUCHER_REASON = { code: 'VOUCHER', label: 'Discount code', maxPercent: 100 }

export interface CampaignInput {
  name: string
  percent: number
  quantity: number
  engineKinds?: EngineKind[]
  expiresAt?: string | null
  prefix?: string
  note?: string
}

function cleanPrefix(raw?: string) {
  const value = (raw ?? 'WZ').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  return value || 'WZ'
}

export async function createCampaign(scope: ManagerScope, input: CampaignInput) {
  const quantity = Math.floor(input.quantity)
  if (quantity < 1) throw ApiError.badRequest('Say how many codes to print.')
  if (quantity > MAX_BATCH) throw ApiError.badRequest(`A batch tops out at ${MAX_BATCH} codes.`)

  const engineKinds = (input.engineKinds ?? []).filter((k) => ENGINE_KINDS.includes(k))
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null
  if (expiresAt && Number.isNaN(expiresAt.getTime())) throw ApiError.badRequest('That expiry date is not a date.')
  if (expiresAt && expiresAt.getTime() < Date.now()) throw ApiError.badRequest('That expiry date is already past.')

  const campaign = await VoucherCampaign.create({
    tenantId: scope.tenantId,
    name: input.name.trim(),
    percent: input.percent,
    quantity,
    engineKinds,
    expiresAt,
    note: input.note?.trim() ?? '',
    createdBy: scope.userId,
  })

  const prefix = cleanPrefix(input.prefix)
  const codes = new Set<string>()
  // Collisions are rare at 32^6, but a batch must never hand out the same code twice.
  while (codes.size < quantity) codes.add(`${prefix}-${codeBody()}`)

  const docs = [...codes].map((code) => ({
    tenantId: scope.tenantId,
    campaignId: campaign._id,
    code,
    percent: input.percent,
    engineKinds,
    expiresAt,
  }))
  for (let i = 0; i < docs.length; i += 500) await Voucher.insertMany(docs.slice(i, i + 500))

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.userId,
    action: 'VOUCHERS_ISSUED',
    entity: 'VoucherCampaign',
    entityId: campaign._id,
    detail: `${quantity} x ${input.percent}% - ${campaign.name}`,
  })

  return campaignView(campaign.toObject(), quantity, 0)
}

type CampaignLike = Omit<VoucherCampaignDoc, 'updatedAt'> & { updatedAt?: Date }

function campaignView(c: CampaignLike, issued: number, redeemed: number) {
  return {
    id: c._id,
    name: c.name,
    percent: c.percent,
    quantity: c.quantity,
    engineKinds: c.engineKinds ?? [],
    expiresAt: c.expiresAt ?? null,
    note: c.note ?? '',
    active: c.active !== false,
    createdAt: c.createdAt,
    issued,
    redeemed,
    left: Math.max(0, issued - redeemed),
  }
}

export async function listCampaigns(scope: ManagerScope) {
  const campaigns = await VoucherCampaign.find({ tenantId: scope.tenantId }).sort({ createdAt: -1 }).lean()
  if (!campaigns.length) return []
  const counts = await Voucher.aggregate<{ _id: { campaignId: string; status: string }; n: number }>([
    { $match: { tenantId: scope.tenantId } },
    { $group: { _id: { campaignId: '$campaignId', status: '$status' }, n: { $sum: 1 } } },
  ])
  const byCampaign = new Map<string, { issued: number; redeemed: number }>()
  for (const row of counts) {
    const cur = byCampaign.get(row._id.campaignId) ?? { issued: 0, redeemed: 0 }
    if (row._id.status !== 'VOID') cur.issued += row.n
    if (row._id.status === 'REDEEMED') cur.redeemed += row.n
    byCampaign.set(row._id.campaignId, cur)
  }
  return campaigns.map((c) => {
    const n = byCampaign.get(c._id) ?? { issued: 0, redeemed: 0 }
    return campaignView(c, n.issued, n.redeemed)
  })
}

export async function campaignCodes(scope: ManagerScope, campaignId: string) {
  const campaign = await VoucherCampaign.findOne({ _id: campaignId, tenantId: scope.tenantId }).lean()
  if (!campaign) throw ApiError.notFound('That batch does not exist.')
  const vouchers = await Voucher.find({ tenantId: scope.tenantId, campaignId }).sort({ code: 1 }).lean()
  const redeemed = vouchers.filter((v) => v.status === 'REDEEMED').length
  return {
    campaign: campaignView(campaign, vouchers.filter((v) => v.status !== 'VOID').length, redeemed),
    codes: vouchers.map((v) => ({
      id: v._id,
      code: v.code,
      status: v.status,
      redeemedAt: v.redeemedAt ?? null,
      redeemedBy: v.redeemedBy ?? null,
      bookingId: v.bookingId ?? null,
      amountOff: v.amountOff ?? null,
    })),
  }
}

/** Stopping a batch never deletes it: spent codes stay on the record, unspent ones stop working. */
export async function voidCampaign(scope: ManagerScope, campaignId: string) {
  const campaign = await VoucherCampaign.findOne({ _id: campaignId, tenantId: scope.tenantId })
  if (!campaign) throw ApiError.notFound('That batch does not exist.')
  campaign.active = false
  await campaign.save()
  const res = await Voucher.updateMany(
    { tenantId: scope.tenantId, campaignId, status: 'ISSUED' },
    { $set: { status: 'VOID' } },
  )
  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.userId,
    action: 'VOUCHERS_STOPPED',
    entity: 'VoucherCampaign',
    entityId: campaign._id,
    detail: `${campaign.name}: ${res.modifiedCount} unused code(s) stopped`,
  })
  return { stopped: res.modifiedCount }
}

function normalise(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, '')
}

async function usableVoucher(tenantId: string, code: string, engineKind?: EngineKind) {
  const voucher = await Voucher.findOne({ tenantId, code: normalise(code) })
  if (!voucher) throw ApiError.notFound('That code is not one of ours.')
  if (voucher.status === 'REDEEMED') throw ApiError.unprocessable('That code has already been used.')
  if (voucher.status === 'VOID') throw ApiError.unprocessable('That code has been stopped.')
  if (voucher.expiresAt && voucher.expiresAt.getTime() < Date.now()) throw ApiError.unprocessable('That code has expired.')
  if (engineKind && voucher.engineKinds.length && !voucher.engineKinds.includes(engineKind)) {
    throw ApiError.unprocessable(`That code is not valid for ${engineKind.toLowerCase().replace(/_/g, ' ')}.`)
  }
  const campaign = await VoucherCampaign.findById(voucher.campaignId).lean()
  if (!campaign || campaign.active === false) throw ApiError.unprocessable('That code has been stopped.')
  return { voucher, campaign }
}

/** Reads a code without spending it, so the desk can tell the customer what it is worth. */
export async function checkVoucher(scope: Scope, code: string) {
  const { voucher, campaign } = await usableVoucher(scope.tenantId, code)
  return {
    code: voucher.code,
    percent: voucher.percent,
    name: campaign.name,
    engineKinds: voucher.engineKinds,
    expiresAt: voucher.expiresAt ?? null,
  }
}

export async function redeemVoucher(scope: Scope, bookingId: string, code: string) {
  const booking = await Booking.findOne({ _id: bookingId, tenantId: scope.tenantId }).lean()
  if (!booking) throw ApiError.notFound('Booking not found.')

  const { voucher, campaign } = await usableVoucher(scope.tenantId, code, booking.engineKind as EngineKind)

  const { order } = await discountBooking(
    scope,
    bookingId,
    {
      reasonCode: VOUCHER_REASON.code,
      percent: voucher.percent,
      note: `${campaign.name} - ${voucher.code}`,
      voucherCode: voucher.code,
    },
    VOUCHER_REASON,
  )

  // Spend the code only once the money is actually off the sale.
  const spent = await Voucher.updateOne(
    { _id: voucher._id, status: 'ISSUED' },
    {
      $set: {
        status: 'REDEEMED',
        redeemedAt: new Date(),
        redeemedBy: scope.agentId,
        bookingId,
        stationId: scope.stationId ?? null,
        kioskId: scope.kioskId ?? null,
        amountOff: Math.abs(order.lines.find((l) => l.productId === 'DISCOUNT')?.unitPrice ?? 0),
      },
    },
  )
  if (spent.modifiedCount === 0) throw ApiError.unprocessable('That code was used a moment ago.')

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: 'VOUCHER_REDEEMED',
    entity: 'Booking',
    entityId: bookingId,
    detail: `${voucher.code} - ${voucher.percent}% off ${booking.ref}`,
    reason: campaign.name,
  })

  return { code: voucher.code, percent: voucher.percent, name: campaign.name, order }
}
