import { http, unwrap } from './client';
import type { PaymentMethod } from './types';

export type InvoiceLineKind = 'ITEM' | 'PENALTY' | 'OVERTIME' | 'DELIVERY' | 'DEPOSIT';

export interface InvoiceLine {
  index: number;
  name: string;
  /** The slip always prints in Arabic; the API falls back to `name` when there is no Arabic one. */
  nameAr: string;
  quantity: number;
  /** The quantity as the customer was charged it — "1h" for an hour, "2" for two items. */
  quantityLabel?: string;
  unitPrice: number;
  total: number;
  isDeposit: boolean;
  kind?: InvoiceLineKind;
}

export interface InvoicePaymentLine {
  label: { en: string; ar: string };
  method: PaymentMethod;
  amount: number;
}

export interface Invoice {
  number: string;
  issuedAt: string;
  seller: {
    name: string;
    legalName: string;
    crNumber: string;
    vatNumber: string;
    currency: string;
  };
  branch: string;
  desk: string | null;
  /** The gate the customer collects from, when that differs from the desk they bought at. */
  gate?: string | null;
  /** The window the customer is charged for. `startedAt` is null until the session begins. */
  session?: { startedAt: string | null; endsAt: string | null };
  servedBy: string;
  customer: { name: string; phone: string };
  lines: InvoiceLine[];
  payments: InvoicePaymentLine[];
  totals: { base: number; vat: number; vatRate: number; total: number; deposit: number };
  qrPayload: string;
  barcode: string;
  status: string;
}

export const invoiceApi = {
  forBooking: (bookingId: string) => unwrap<Invoice>(http.get(`/bookings/${bookingId}/invoice`)),
  xmlForBooking: async (bookingId: string): Promise<{ xml: string; filename: string }> => {
    const res = await http.get(`/bookings/${bookingId}/invoice/xml`, {
      responseType: 'text' as const,
    });
    const disposition = (res.headers as Record<string, string>)['content-disposition'] ?? '';
    const match = /filename="([^"]+)"/.exec(disposition);
    const filename = match?.[1] ?? `invoice-${bookingId}.xml`;
    return { xml: res.data as string, filename };
  },
};
