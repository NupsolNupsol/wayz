import { customAlphabet } from 'nanoid'
import type { OrderLine } from '../models/index.js'

const digits = customAlphabet('0123456789', 12)

export function makeBarcode(): string {
  return digits()
}

export function splitVat(inclusive: number, rate: number) {
  const net = inclusive / (1 + rate)
  return { net: round2(net), vat: round2(inclusive - net) }
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function computeTotals(lines: OrderLine[], vatRate: number) {
  let taxableInclusive = 0
  let depositTotal = 0
  for (const l of lines) {
    if (l.isDeposit) depositTotal += l.unitPrice * l.quantity
    else taxableInclusive += l.unitPrice * l.quantity
  }
  const { net, vat } = splitVat(taxableInclusive, vatRate)
  return {
    subtotal: net,
    vat,
    depositTotal: round2(depositTotal),
    total: round2(taxableInclusive + depositTotal),
  }
}
