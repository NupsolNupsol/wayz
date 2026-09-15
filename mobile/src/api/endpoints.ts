import { get, patch, post } from './client'
import type {
  AssetTypeLite,
  AssetUnit,
  AvailableTransition,
  BoatSpace,
  Booking,
  Customer,
  DashboardStats,
  Delivery,
  DeliveryDetail,
  EngineKind,
  Incident,
  IncidentCatalogue,
  Me,
  Order,
  OtpChannel,
  PackingSuggestResponse,
  Payment,
  PaymentMethod,
  Product,
  Shift,
  VerificationPurpose,
} from '@/types'

export interface BagInput {
  category?: string
  description?: string
  dimensions?: { w: number; h: number; d: number }
  weight?: number
}

export interface CreateBookingInput {
  customerId: string
  engineKind: EngineKind
  productId: string
  quantity?: number
  durationMin?: number
  /** The boat, on Lagoon: seats are counted against a named hull, not a type. */
  unitId?: string
  bags?: BagInput[]
  metadata?: Record<string, unknown>
}

export interface TransitionPayload {
  scannedUnitId?: string
  scannedBarcodes?: string[]
  unitId?: string
  reason?: string
  durationMin?: number
  inspectionDone?: boolean
  safetyAck?: boolean
  boardingVerified?: boolean
}

export interface PaymentSplit {
  method: PaymentMethod
  amount: number
  cardScheme?: string
  /** Set on the second half when somebody other than the booking's customer is paying it. */
  payerId?: string
}

export interface VerificationChallenge {
  delivered: string
  channel: OtpChannel
  destinationMasked: string
  expiresInSec: number
  error?: string
}

export const authApi = {
  login: (email: string, password: string) => post<{ token: string; user: Me }>('/auth/login', { email, password }),
  me: () => get<Me>('/auth/me'),
}

export const catalogueApi = {
  products: (engineKind?: EngineKind) => get<Product[]>('/catalogue/products', engineKind ? { engineKind } : undefined),
  units: () => get<AssetUnit[]>('/catalogue/units'),
  assetTypes: () => get<AssetTypeLite[]>('/catalogue/asset-types'),
  packingSuggestions: (bags: BagInput[]) => post<PackingSuggestResponse>('/catalogue/packing-suggestions', { bags }),
}

export type OtpIntent = 'VERIFY_PHONE' | 'HANDOVER_BAG'

/**
 * Proof that the person at the counter is who the booking says they are.
 *
 * The server refuses to take money from anyone it has not seen a code from in the last half hour,
 * so this is not a formality the app can skip — it is part of every sale.
 */
export const otpApi = {
  send: (destination: string, intent: OtpIntent = 'VERIFY_PHONE', channel: OtpChannel = 'WHATSAPP') =>
    post<{ delivered: string; channel: OtpChannel; code?: string; error?: string }>('/otp/send', {
      phone: destination,
      intent,
      channel,
    }),
  verify: (destination: string, code: string, intent: OtpIntent = 'VERIFY_PHONE') =>
    post<{ verified: boolean }>('/otp/verify', { phone: destination, intent, code }),
}

export const tripApi = {
  boats: (assetTypeId?: string) => get<BoatSpace[]>('/lagoon/trips/boats', assetTypeId ? { assetTypeId } : undefined),
}

export const customerApi = {
  list: (q?: string) => get<Customer[]>('/customers', q ? { q } : undefined),
  get: (id: string) => get<Customer & { bookings: Booking[] }>(`/customers/${id}`),
  create: (input: { name: string; phone: string; email?: string }) => post<Customer>('/customers', input),
}

export const bookingApi = {
  list: (params?: { status?: string; engineKind?: EngineKind }) => get<Booking[]>('/bookings', params),
  get: (id: string) => get<Booking>(`/bookings/${id}`),
  order: (id: string) => get<Order>(`/bookings/${id}/order`),
  transitions: (id: string) =>
    get<{ allowed: boolean; message: string; transitions: AvailableTransition[] }>(`/bookings/${id}/transitions`),
  create: (input: CreateBookingInput) => post<{ booking: Booking; order: Order }>('/bookings', input),
  pay: (id: string, splits: PaymentSplit[]) => post<{ booking: Booking; order: Order }>(`/bookings/${id}/pay`, { splits }),
  payments: (id: string) => get<Payment[]>(`/bookings/${id}/payments`),
  reserve: (id: string, unitId?: string) => post<Booking>(`/bookings/${id}/reserve`, unitId ? { unitId } : {}),
  reassign: (id: string, unitId: string, reason: string) => post<Booking>(`/bookings/${id}/reassign`, { unitId, reason }),
  scanOut: (id: string, barcode: string) => post<Booking>(`/bookings/${id}/scan-out`, { barcode }),
  transition: (id: string, code: string, payload?: TransitionPayload) =>
    post<Booking>(`/bookings/${id}/transition`, { code, payload }),

  sendVerification: (id: string, purpose: VerificationPurpose = 'RETRIEVAL', channel: OtpChannel = 'WHATSAPP') =>
    post<VerificationChallenge>(`/bookings/${id}/verification/send`, { purpose, channel }),
  confirmVerification: (
    id: string,
    input: Record<string, unknown>,
    purpose: VerificationPurpose = 'RETRIEVAL',
  ) => post<Booking>(`/bookings/${id}/verification/confirm`, { purpose, ...input }),
}

export const deliveryApi = {
  station: (params?: { status?: string; bookingId?: string }) => get<Delivery[]>('/deliveries/station', params),
  get: (id: string) => get<DeliveryDetail>(`/deliveries/${id}`),
  create: (input: {
    bookingId: string
    address: string
    notes?: string
    contactPhone?: string
    origin: 'AT_STORAGE' | 'CUSTOMER_CONTACT'
    fee?: number
  }) => post<Delivery>('/deliveries', input),
  stationTransition: (id: string, code: string, payload?: { compartmentCode?: string; reason?: string }) =>
    post<Delivery>(`/deliveries/station/${id}/transition`, { code, payload }),
}

export const dashboardApi = {
  stats: () => get<DashboardStats>('/dashboard/stats'),
}

export const shiftApi = {
  current: () => get<Shift | null>('/shift/current'),
  open: () => post<Shift>('/shift/open'),
  blindCount: (id: string, countedCash: number) => post<Shift>(`/shift/${id}/blind-count`, { countedCash }),
  resolve: (id: string, note: string) => post<Shift>(`/shift/${id}/resolve`, { note }),
}

export const incidentApi = {
  list: () => get<Incident[]>('/incidents'),
  catalogue: () => get<IncidentCatalogue>('/engines/incident-types'),
  create: (input: { type: string; description: string; bookingId?: string; engineKind?: EngineKind }) =>
    post<Incident>('/incidents', input),
  updateStatus: (id: string, status: string) => patch<Incident>(`/incidents/${id}`, { status }),
}
