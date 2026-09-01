import { round2 } from '../utils/helpers.js'

export const DEFAULT_VAT_RATE = 0.15

export interface TaxSplit {
  baseAmount: number
  vatAmount: number
  totalAmount: number
  vatRate: number
}

export function splitInclusive(totalAmount: number, vatRate: number): TaxSplit {
  const baseAmount = round2(totalAmount / (1 + vatRate))
  return {
    baseAmount,
    vatAmount: round2(totalAmount - baseAmount),
    totalAmount: round2(totalAmount),
    vatRate,
  }
}

export function noVat(amount: number): TaxSplit {
  return { baseAmount: round2(amount), vatAmount: 0, totalAmount: round2(amount), vatRate: 0 }
}

export function addVat(baseAmount: number, vatRate: number): TaxSplit {
  const vatAmount = round2(baseAmount * vatRate)
  return {
    baseAmount: round2(baseAmount),
    vatAmount,
    totalAmount: round2(baseAmount + vatAmount),
    vatRate,
  }
}

export interface ZatcaInput {
  salesBase: number
  returnsBase: number
  purchasesBase: number
  vatRate: number
  salesVat?: number
  returnsVat?: number
  purchasesVat?: number
}

export interface ZatcaReturn {
  salesBase: number
  salesVat: number
  returnsBase: number
  returnsVat: number
  purchasesBase: number
  purchasesVat: number
  netTaxableBase: number
  dueVat: number
  vatRate: number
  refundable: boolean
}

export function zatcaReturn(input: ZatcaInput): ZatcaReturn {
  const { salesBase, returnsBase, purchasesBase, vatRate } = input
  const netTaxableBase = round2(salesBase - returnsBase - purchasesBase)
  const dueVat = round2(netTaxableBase * vatRate)

  const vatOn = (base: number, actual: number | undefined) =>
    round2(actual === undefined ? base * vatRate : actual)

  return {
    salesBase: round2(salesBase),
    salesVat: vatOn(salesBase, input.salesVat),
    returnsBase: round2(returnsBase),
    returnsVat: vatOn(returnsBase, input.returnsVat),
    purchasesBase: round2(purchasesBase),
    purchasesVat: vatOn(purchasesBase, input.purchasesVat),
    netTaxableBase,
    dueVat,
    vatRate,
    refundable: netTaxableBase < 0,
  }
}

export const DEFAULT_ZAKAT_RATE = 0.025

export interface ZakatInput {
  salesBase: number
  returnsBase: number
  costsBase: number
  vatPaid: number
  zakatRate: number
}

export interface ZakatAssessment {
  revenue: number
  costs: number
  vatPaid: number
  netProfit: number
  zakatRate: number
  zakatDue: number
  profitable: boolean
}

export function zakatAssessment(input: ZakatInput): ZakatAssessment {
  const revenue = round2(input.salesBase - input.returnsBase)
  const costs = round2(input.costsBase)
  const vatPaid = round2(Math.max(0, input.vatPaid))
  const netProfit = round2(revenue - costs - vatPaid)
  const profitable = netProfit > 0

  return {
    revenue,
    costs,
    vatPaid,
    netProfit,
    zakatRate: input.zakatRate,
    zakatDue: profitable ? round2(netProfit * input.zakatRate) : 0,
    profitable,
  }
}
