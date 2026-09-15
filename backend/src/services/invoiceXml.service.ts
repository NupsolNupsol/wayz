import crypto from 'crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { generateInvoiceXml } from '@talha7k/zatca';
import { InvoiceXml, Order, Tenant } from '../models/index.js';
import type { BookingHydrated } from '../models/booking.model.js';
import type { Scope } from '../interfaces/index.js';
import { ApiError } from '../utils/ApiError.js';
import { round2, splitVat } from '../utils/helpers.js';
import { nextSequence } from './counter.service.js';
import { DEFAULT_VAT_RATE } from '../domain/tax.js';

function getUnitCode(engineType: string): string {
  if (['SHOP_AND_DROP', 'MOBILITY'].includes(engineType)) {
    return 'HUR';
  }

  return 'C62';
}

function toIssueParts(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const issueDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const issueTime = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return { issueDate, issueTime };
}

function hashBase64Sha256(input: string): string {
  const hex = crypto.createHash('sha256').update(input, 'utf8').digest('hex');
  return Buffer.from(hex, 'utf8').toString('base64');
}

function initialPreviousHash(): string {
  return hashBase64Sha256('0');
}

function storageDirForTenant(tenantId: string): string {
  // backend/storage/zatca/<tenantId>
  return path.resolve(process.cwd(), 'storage', 'zatca', tenantId);
}

export async function buildInvoiceXml(
  scope: Scope,
  booking: BookingHydrated
): Promise<{ xml: string; filename: string }> {
  const order = await Order.findById(booking.orderId).lean();
  if (!order) throw ApiError.notFound('Order not found.');

  const tenant = await Tenant.findById(scope.tenantId).lean();
  if (!tenant) throw ApiError.notFound('Tenant not found.');

  // Idempotency: if this booking already has a persisted XML, return that file
  const existing = await InvoiceXml.findOne({
    tenantId: scope.tenantId,
    bookingId: booking._id,
  }).lean();
  if (existing) {
    try {
      const xml = await fs.readFile(existing.filePath, 'utf-8');
      return { xml, filename: `invoice-${existing.invoiceNumber}.xml` };
    } catch {
      // file missing -> regenerate below and overwrite record
    }
  }

  const vatRate = booking.vatRate ?? tenant.vatRate ?? DEFAULT_VAT_RATE;
  const vatPercent = Math.round(vatRate * 100);

  const invoiceNumber = order.ref;
  const uuid = crypto.randomUUID();
  const issuedAt = order.createdAt ? new Date(order.createdAt) : new Date();
  const { issueDate, issueTime } = toIssueParts(issuedAt);

  // Fetch latest invoice for this tenant to continue the hash chain (KSA-5 chaining)
  const latest = await InvoiceXml.findOne({ tenantId: scope.tenantId })
    .sort({ invoiceCounter: -1 })
    .lean();
  const previousInvoiceHash = latest?.invoiceHash ?? initialPreviousHash();
  const invoiceCounter = await nextSequence('invoiceXml' as any).catch(
    () => (latest?.invoiceCounter ?? 0) + 1
  );

  const currencyCode = tenant.currency ?? 'SAR';

  const supplier = {
    nameAr: tenant.legalName,
    nameEn: tenant.name,
    vatNumber: tenant.vatNumber,
    crNumber: tenant.crNumber,
  };

  const unitCode = getUnitCode(order.engineKind);

  const zatcaLines = order.lines.map((line, idx) => {
    const inclusive = round2(line.unitPrice * (line.quantity ?? 1));
    const isTaxable = line.taxable && vatRate > 0;
    const { net, vat } = isTaxable ? splitVat(inclusive, vatRate) : { net: inclusive, vat: 0 };
    const taxable = isTaxable;

    return {
      id: idx + 1,
      quantity: line.quantity ?? 1,
      unitCode,
      lineExtensionAmount: net,
      taxAmount: vat,
      itemName: line.nameAr || line.name,
      taxCategoryId: taxable ? ('S' as const) : ('O' as const),
      taxPercent: taxable ? vatPercent : 0,
      priceAmount: round2(line.unitPrice / (taxable ? 1 + vatRate : 1)),
      _net: net,
      _vat: vat,
    };
  });

  const lineExtensionAmount = round2(zatcaLines.reduce((s, l) => s + l._net, 0));
  const taxAmount = round2(zatcaLines.reduce((s, l) => s + l._vat, 0));
  const taxExclusiveAmount = lineExtensionAmount;
  const taxInclusiveAmount = round2(taxExclusiveAmount + taxAmount);
  const payableAmount = taxInclusiveAmount;

  const subtotalMap = new Map<
    string,
    {
      taxableAmount: number;
      taxAmount: number;
      percent: number;
      taxCategoryId: 'S' | 'O' | 'Z' | 'E' | 'AE';
    }
  >();
  for (const l of zatcaLines) {
    const key = `${l.taxCategoryId}-${l.taxPercent}`;
    const cur = subtotalMap.get(key) ?? {
      taxableAmount: 0,
      taxAmount: 0,
      percent: l.taxPercent,
      taxCategoryId: l.taxCategoryId,
    };
    cur.taxableAmount = round2(cur.taxableAmount + l._net);
    cur.taxAmount = round2(cur.taxAmount + l._vat);
    subtotalMap.set(key, cur);
  }
  const taxSubtotals = [...subtotalMap.values()].map((s) => ({
    taxableAmount: s.taxableAmount,
    taxAmount: s.taxAmount,
    percent: s.percent,
    taxCategoryId: s.taxCategoryId,
  }));

  if (taxSubtotals.length === 0) {
    taxSubtotals.push({
      taxableAmount: taxExclusiveAmount,
      taxAmount,
      percent: vatPercent,
      taxCategoryId: 'S',
    });
  }

  const invoiceLines = zatcaLines.map(({ _net, _vat, ...rest }) => rest);

  const customer = booking.customerName
    ? {
        name: booking.customerName,
        vatNumber: (booking as any).customerVatNumber || '',
      }
    : undefined;

  const xml = generateInvoiceXml({
    invoiceNumber,
    uuid,
    issueDate,
    issueTime,
    invoiceTypeCode: '388',
    invoiceTypeCodeName: '0200000',
    profileId: 'reporting:1.0',
    invoiceCounter,
    previousInvoiceHash,
    currencyCode,
    supplier,
    ...(customer && customer.vatNumber ? { customer } : {}),
    lineExtensionAmount,
    taxExclusiveAmount,
    taxInclusiveAmount,
    payableAmount,
    taxAmount,
    taxSubtotals,
    invoiceLines,
  });

  const invoiceHash = hashBase64Sha256(xml);
  const filename = `invoice-${invoiceNumber}.xml`;
  const dir = storageDirForTenant(scope.tenantId);
  const filePath = path.join(dir, filename);

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, xml, 'utf-8');

  // Persist hash chain; upsert on booking to keep idempotency if regenerated after file loss
  await InvoiceXml.updateOne(
    { tenantId: scope.tenantId, bookingId: booking._id },
    {
      $set: {
        tenantId: scope.tenantId,
        bookingId: booking._id,
        orderId: order._id,
        invoiceNumber,
        uuid,
        invoiceCounter,
        previousInvoiceHash,
        invoiceHash,
        filePath,
      },
    },
    { upsert: true }
  );

  return { xml, filename };
}

export async function getPersistedInvoiceXml(
  scope: Scope,
  bookingId: string
): Promise<{ xml: string; filename: string } | null> {
  const doc = await InvoiceXml.findOne({ tenantId: scope.tenantId, bookingId }).lean();
  if (!doc) return null;
  try {
    const xml = await fs.readFile(doc.filePath, 'utf-8');
    return { xml, filename: `invoice-${doc.invoiceNumber}.xml` };
  } catch {
    return null;
  }
}
