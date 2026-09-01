import ExcelJS from 'exceljs'
import { activityBreakdown, ledger, vatReturn } from './accounting.service.js'
import { ACTIVITY_LABELS } from '../constants/labels.constants.js'
import type { AccountingScope, PeriodFilter } from '../interfaces/index.js'
import type { EngineKind } from '../domain/types.js'
import { transactionSummary } from './transactions.service.js'

const DETAIL_COLUMNS = [
  { header: 'تاريخ', key: 'date', width: 14 },
  { header: 'نوع العملية', key: 'processType', width: 20 },
  { header: 'التفاصيل', key: 'details', width: 42 },
  { header: 'رقم المرجع', key: 'reference', width: 20 },
  { header: 'المبيعات بدون ضريبة', key: 'baseAmount', width: 22 },
  { header: 'مبلغ الضريبة', key: 'vatAmount', width: 16 },
  { header: 'المبيعات شاملة الضريبة', key: 'totalAmount', width: 24 },
]

const MONEY = '#,##0.00'

export const SHEET_NAMES: Record<EngineKind, string> = {
  LAGOON: 'مبيعات لاجون',
  MOBILITY: 'مبيعات اسكوترات',
  SHOP_AND_DROP: 'مبيعات شوب',
  COTE_RESTAURANT: 'مبيعات كوت',
  ANAAM: 'مبيعات انعام',
}

export const SUMMARY_SHEET = 'مجمع تقرير مبيعات'
export const COMMISSION_SHEET = 'عمولة البطاقات'

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true }
  row.alignment = { horizontal: 'center', vertical: 'middle' }
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4F1' } }
    cell.border = { bottom: { style: 'thin' } }
  })
}

function addDetailSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  title: string,
  rows: Awaited<ReturnType<typeof ledger>>,
) {
  const sheet = workbook.addWorksheet(name, { views: [{ rightToLeft: true, state: 'frozen', ySplit: 3 }] })

  sheet.mergeCells(1, 1, 1, DETAIL_COLUMNS.length)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = title
  titleCell.font = { bold: true, size: 13 }
  titleCell.alignment = { horizontal: 'center' }

  sheet.columns = DETAIL_COLUMNS.map((c) => ({ key: c.key, width: c.width }))
  const header = sheet.getRow(3)
  DETAIL_COLUMNS.forEach((c, i) => {
    header.getCell(i + 1).value = c.header
  })
  styleHeader(header)

  for (const r of rows) {
    sheet.addRow({
      date: new Date(r.date),
      processType: r.processType,
      details: r.details,
      reference: r.reference,
      baseAmount: r.baseAmount,
      vatAmount: r.vatAmount,
      totalAmount: r.totalAmount,
    })
  }

  sheet.getColumn('date').numFmt = 'yyyy-mm-dd'
  for (const key of ['baseAmount', 'vatAmount', 'totalAmount']) sheet.getColumn(key).numFmt = MONEY

  const first = 4
  const last = sheet.rowCount
  const totals = sheet.addRow({
    date: null,
    processType: 'الإجمالي',
    details: '',
    reference: '',
    baseAmount: last >= first ? { formula: `SUM(E${first}:E${last})` } : 0,
    vatAmount: last >= first ? { formula: `SUM(F${first}:F${last})` } : 0,
    totalAmount: last >= first ? { formula: `SUM(G${first}:G${last})` } : 0,
  })
  totals.font = { bold: true }
  totals.eachCell((cell) => {
    cell.border = { top: { style: 'double' } }
  })

  return sheet
}

function addSummarySheet(
  workbook: ExcelJS.Workbook,
  breakdown: Awaited<ReturnType<typeof activityBreakdown>>,
  figures: Awaited<ReturnType<typeof vatReturn>>,
) {
  const sheet = workbook.addWorksheet(SUMMARY_SHEET, { views: [{ rightToLeft: true }] })

  sheet.mergeCells(1, 1, 1, 5)
  const title = sheet.getCell(1, 1)
  title.value = 'تقرير مجمع شامل المبيعات'
  title.font = { bold: true, size: 13 }
  title.alignment = { horizontal: 'center' }

  sheet.columns = [
    { key: 'activity', width: 34 },
    { key: 'salesBase', width: 24 },
    { key: 'salesVat', width: 18 },
    { key: 'salesTotal', width: 24 },
    { key: 'returnsBase', width: 24 },
  ]

  const header = sheet.getRow(3)
  ;['تفاصيل المبيعات', 'مبيعات غير شاملة 15 %', 'مبلغ الضريبة', 'مبيعات شاملة 15 %', 'المرتجعات بدون ضريبة'].forEach(
    (h, i) => {
      header.getCell(i + 1).value = h
    },
  )
  styleHeader(header)

  for (const a of breakdown.activities) {
    if (!a.salesTotal && !a.returnsTotal) continue
    sheet.addRow({
      activity: `اجمالي مبيعات ${a.label.ar}`,
      salesBase: a.salesBase,
      salesVat: a.salesVat,
      salesTotal: a.salesTotal,
      returnsBase: a.returnsBase,
    })
  }

  const totals = sheet.addRow({
    activity: 'الاجماليات',
    salesBase: breakdown.totals.salesBase,
    salesVat: breakdown.totals.salesVat,
    salesTotal: breakdown.totals.salesTotal,
    returnsBase: breakdown.totals.returnsBase,
  })
  totals.font = { bold: true }
  totals.eachCell((cell) => {
    cell.border = { top: { style: 'double' } }
  })

  for (const key of ['salesBase', 'salesVat', 'salesTotal', 'returnsBase']) sheet.getColumn(key).numFmt = MONEY

  addZatcaReturn(sheet, figures)

  return sheet
}

/**
 * The VAT return is its own four-column table — description, base, rate, tax — so the
 * rows are written positionally rather than through the activity table's column keys.
 * Sharing those keys put the tax amounts in a column that was never headed for them and
 * dropped the tax due under "sales ex-VAT".
 */
function addZatcaReturn(sheet: ExcelJS.Worksheet, figures: Awaited<ReturnType<typeof vatReturn>>) {
  const rate = `${(figures.vatRate * 100).toFixed(0)}%`

  sheet.addRow([])
  sheet.addRow([])

  const header = sheet.addRow(['البيان', 'المبلغ', 'نسبة الضريبة %', 'مبلغ الضريبة'])
  styleHeader(header)

  const lines: [string, number, string, number | string][] = [
    ['اجمالي المبيعات بدون ضريبة', figures.salesBase, rate, figures.salesVat],
    ['اجمالي المرتجعات بدون ضريبة', figures.returnsBase, rate, figures.returnsVat],
    ['اجمالي المشتريات والمصروفات بدون ضريبة', figures.purchasesBase, rate, figures.purchasesVat],
    ['صافي الوعاء الضريبي', figures.netTaxableBase, '', ''],
  ]

  for (const line of lines) {
    const row = sheet.addRow(line)
    row.getCell(1).font = { bold: line[0].startsWith('صافي') }
    row.getCell(3).alignment = { horizontal: 'center' }
    for (const column of [2, 4]) {
      if (typeof row.getCell(column).value === 'number') row.getCell(column).numFmt = MONEY
    }
  }

  const due = sheet.addRow([
    figures.refundable
      ? 'الضريبة القابلة للاسترداد من هيئة الزكاة والدخل'
      : 'الضريبة المستحقة لهيئة الزكاة والدخل',
    figures.netTaxableBase,
    rate,
    Math.abs(figures.dueVat),
  ])
  due.font = { bold: true }
  due.getCell(3).alignment = { horizontal: 'center' }
  due.eachCell((cell) => {
    cell.border = { top: { style: 'double' } }
  })
  for (const column of [2, 4]) due.getCell(column).numFmt = MONEY

  return due
}

function addCommissionSheet(workbook: ExcelJS.Workbook, figures: Awaited<ReturnType<typeof transactionSummary>>) {
  const sheet = workbook.addWorksheet(COMMISSION_SHEET, { views: [{ rightToLeft: true }] })

  sheet.mergeCells(1, 1, 1, 5)
  const title = sheet.getCell(1, 1)
  title.value = 'عمولة البطاقات المخصومة من البنك'
  title.font = { bold: true, size: 13 }
  title.alignment = { horizontal: 'center' }

  sheet.columns = [
    { key: 'scheme', width: 26 },
    { key: 'rate', width: 18 },
    { key: 'count', width: 14 },
    { key: 'gross', width: 24 },
    { key: 'commission', width: 22 },
  ]

  const header = sheet.getRow(3)
  ;['نوع البطاقة', 'نسبة العمولة %', 'عدد العمليات', 'اجمالي المبيعات', 'مبلغ العمولة'].forEach((h, i) => {
    header.getCell(i + 1).value = h
  })
  styleHeader(header)

  for (const row of figures.byScheme) {
    if (!row.count) continue
    sheet.addRow({
      scheme: row.label.ar,
      rate: row.rate,
      count: row.count,
      gross: row.grossAmount,
      commission: row.commissionAmount,
    })
  }

  const totals = sheet.addRow({
    scheme: 'الاجماليات',
    rate: figures.totals.effectiveRate,
    count: figures.totals.count,
    gross: figures.totals.grossAmount,
    commission: figures.totals.commissionAmount,
  })
  totals.font = { bold: true }
  totals.eachCell((cell) => {
    cell.border = { top: { style: 'double' } }
  })

  const net = sheet.addRow({
    scheme: 'صافي المحصل بعد العمولة',
    rate: null,
    count: null,
    gross: null,
    commission: figures.totals.netSettled,
  })
  net.font = { bold: true }

  sheet.getColumn('rate').numFmt = '0.00%'
  for (const key of ['gross', 'commission']) sheet.getColumn(key).numFmt = MONEY

  return sheet
}

async function toBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

function stamp(filter: PeriodFilter): string {
  return `${filter.from ?? 'all'}_${filter.to ?? 'all'}`
}

export async function activityWorkbook(scope: AccountingScope, filter: PeriodFilter, engineKind: EngineKind) {
  const scoped: PeriodFilter = { ...filter, engineKind }
  const [rows, breakdown, figures, cards] = await Promise.all([
    ledger(scope, scoped),
    activityBreakdown(scope, scoped),
    vatReturn(scope, scoped),
    transactionSummary(scope, scoped),
  ])

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'WAYZ'
  workbook.created = new Date()

  const label = ACTIVITY_LABELS[engineKind]
  addDetailSheet(workbook, SHEET_NAMES[engineKind], `تفاصيل مبيعات ${label.ar}`, rows)
  addSummarySheet(workbook, breakdown, figures)
  addCommissionSheet(workbook, cards)

  return {
    buffer: await toBuffer(workbook),
    filename: `wayz-${engineKind.toLowerCase()}-${stamp(filter)}.xlsx`,
  }
}

export async function fullWorkbook(scope: AccountingScope, filter: PeriodFilter) {
  const base: PeriodFilter = { from: filter.from, to: filter.to }
  const [breakdown, figures, cards] = await Promise.all([
    activityBreakdown(scope, base),
    vatReturn(scope, base),
    transactionSummary(scope, base),
  ])

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'WAYZ'
  workbook.created = new Date()

  addSummarySheet(workbook, breakdown, figures)
  addCommissionSheet(workbook, cards)

  return {
    buffer: await toBuffer(workbook),
    filename: `wayz-all-activities-${stamp(filter)}.xlsx`,
  }
}
