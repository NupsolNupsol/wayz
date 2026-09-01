import { Counter } from '../models/counter.model.js'

export const ID_PREFIX = {
  booking: 'bk',
  order: 'ord',
  payment: 'pay',
  receipt: 'rcp',
  incident: 'inc',
  customer: 'cus',
  shift: 'shf',
  audit: 'aud',
  notification: 'ntf',
  evidence: 'evd',
  site: 'site',
  station: 'stn',
  kiosk: 'ksk',
  user: 'usr',
  product: 'prd',
  assetType: 'at',
  delivery: 'dlv',
  cashMovement: 'cm',
  expense: 'exp',
  season: 'ssn',
  cardTransaction: 'txn',
} as const

export type CounterName = keyof typeof ID_PREFIX

const PAD = 4

export async function nextSequence(name: CounterName): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean()
  return doc!.seq
}

export function pad(seq: number): string {
  return String(seq).padStart(PAD, '0')
}

export function formatId(name: CounterName, seq: number): string {
  return `${ID_PREFIX[name]}-${pad(seq)}`
}

export async function nextId(name: CounterName): Promise<string> {
  return formatId(name, await nextSequence(name))
}

export async function ensureCounterAtLeast(name: CounterName, value: number): Promise<void> {
  await Counter.updateOne({ _id: name, seq: { $lt: value } }, { $set: { seq: value } }, { upsert: true }).catch(async () => {
    await Counter.updateOne({ _id: name, seq: { $lt: value } }, { $set: { seq: value } })
  })
}
