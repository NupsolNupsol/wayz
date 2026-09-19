// src/api/endpoints.ts
import { get, patch, post, http } from "./client";
import type {
  AssetTypeLite,
  AssetUnit,
  AvailableTransition,
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
  PaymentMethod,
  Product,
  Shift,
  VerificationPurpose,
} from "@/types";

/* ---------- shared input types ---------- */

export interface BagInput {
  category?: string;
  description?: string;
  dimensions?: { w: number; h: number; d: number };
  weight?: number;
}

export interface CreateBookingInput {

  customerId: string;
  engineKind: EngineKind;
  productId: string;
  quantity?: number;
  durationMin?: number;
  bags?: BagInput[];
  metadata?: Record<string, unknown>;
}

export interface TransitionPayload {
  scannedUnitId?: string;
  scannedBarcodes?: string[];
  unitId?: string;
  reason?: string;
  durationMin?: number;
  inspectionDone?: boolean;
  safetyAck?: boolean;
  boardingVerified?: boolean;
}

export interface PaymentSplit {
  method: PaymentMethod;
  amount: number;
  cardScheme?: string;
}

export interface VerificationChallenge {
  delivered: string;
  channel: OtpChannel;
  destinationMasked: string;
  expiresInSec: number;
  error?: string;
}

/* ---------- auth ---------- */

export const authApi = {
  login: (email: string, password: string) =>
    post<{ token: string; user: Me }>("/auth/login", { email, password }),
  me: () => get<Me>("/auth/me"),
};

/* ---------- catalogue ---------- */

export const catalogueApi = {
  products: (engineKind?: EngineKind) =>
    get<Product[]>("/catalogue/products", engineKind ? { engineKind } : undefined),
  units: () => get<AssetUnit[]>("/catalogue/units"),
  assetTypes: () => get<AssetTypeLite[]>("/catalogue/asset-types"),
  packingSuggestions: (bags: BagInput[]) =>
    post<PackingSuggestResponse>("/catalogue/packing-suggestions", { bags }),
};


/* ---------- customers ---------- */

export const customerApi = {
  list: (q?: string) => get<Customer[]>("/customers", q ? { q } : undefined),
  get: (id: string) =>
    get<Customer & { bookings: Booking[] }>(`/customers/${id}`),
  create: (input: { name: string; phone: string; email?: string }) =>
    post<Customer>("/customers", input),
};

/* ---------- bookings ---------- */

export const bookingApi = {
  list: (params?: { status?: string; engineKind?: EngineKind }) =>
    get<Booking[]>("/bookings", params),

  get: (id: string) => get<Booking>(`/bookings/${id}`),

  order: (id: string) => get<Order>(`/bookings/${id}/order`),

  transitions: (id: string) =>

    get<{ allowed: boolean; message: string; transitions: AvailableTransition[] }>(
      `/bookings/${id}/transitions`,
    ),

  create: (input: CreateBookingInput) =>
    post<{ booking: Booking; order: Order }>("/bookings", input),

  pay: (id: string, splits: PaymentSplit[]) =>
    post<{ booking: Booking; order: Order }>(`/bookings/${id}/pay`, { splits }),

  reserve: (id: string, unitId?: string) =>
    post<Booking>(`/bookings/${id}/reserve`, unitId ? { unitId } : {}),

  reassign: (id: string, unitId: string, reason: string) =>
    post<Booking>(`/bookings/${id}/reassign`, { unitId, reason }),

  scanOut: (id: string, barcode: string) =>
    post<Booking>(`/bookings/${id}/scan-out`, { barcode }),

  transition: (id: string, code: string, payload?: TransitionPayload) =>
    post<Booking>(`/bookings/${id}/transition`, { code, payload }),

  sendVerification: (
    id: string,
    purpose: VerificationPurpose = "RETRIEVAL",
    channel: OtpChannel = "WHATSAPP",
  ) =>
    post<VerificationChallenge>(`/bookings/${id}/verification/send`, {
      purpose,
      channel,
    }),

  confirmVerification: (
    id: string,
    input: Record<string, unknown>,
    purpose: VerificationPurpose = "RETRIEVAL",
  ) =>
    post<Booking>(`/bookings/${id}/verification/confirm`, {
      purpose,
      ...input,
    }),

  /** Apply a discount to a booking (used by the DiscountButton). */
  discount: (
    id: string,
    input: { reasonCode: string; percent: number; note?: string },
  ) =>
    post<{ booking: Booking; order: Order }>(
      `/bookings/${id}/discount`,
      input,
    ),
};

/* ---------- deliveries ---------- */

export const deliveryApi = {
  station: (params?: { status?: string; bookingId?: string }) =>
    get<Delivery[]>("/deliveries/station", params),

  get: (id: string) => get<DeliveryDetail>(`/deliveries/${id}`),

  create: (input: {
    bookingId: string;
    address: string;
    notes?: string;
    contactPhone?: string;
    origin: "AT_STORAGE" | "CUSTOMER_CONTACT";
    fee?: number;
  }) => post<Delivery>("/deliveries", input),

  stationTransition: (
    id: string,
    code: string,
    payload?: { compartmentCode?: string; reason?: string },
  ) =>
    post<Delivery>(`/deliveries/station/${id}/transition`, {
      code,
      payload,
    }),
};

/* ---------- dashboard ---------- */

export const dashboardApi = {
  stats: () => get<DashboardStats>("/dashboard/stats"),
};

/* ---------- shift ---------- */

export const shiftApi = {
  current: () => get<Shift | null>("/shift/current"),
  open: () => post<Shift>("/shift/open"),
  blindCount: (id: string, countedCash: number) =>
    post<Shift>(`/shift/${id}/blind-count`, { countedCash }),
  resolve: (id: string, note: string) =>
    post<Shift>(`/shift/${id}/resolve`, { note }),
};

/* ---------- incidents ---------- */

export const incidentApi = {
  list: () => get<Incident[]>("/incidents"),
  catalogue: () => get<IncidentCatalogue>("/engines/incident-types"),
  create: (input: {
    type: string;
    description: string;
    bookingId?: string;
    engineKind?: EngineKind;
  }) => post<Incident>("/incidents", input),
  updateStatus: (id: string, status: string) =>
    patch<Incident>(`/incidents/${id}`, { status }),
};

/* ---------- till types ---------- */

export type CashMovementKind = "FLOAT_IN" | "PAY_OUT" | "DROP";

export interface CashMovement {
  _id: string;
  shiftId: string;
  actorId: string;
  actorName: string;
  kind: CashMovementKind;
  amount: number;
  reason: string;
  reference: string;
  createdAt: string;
}

export interface DrawerBreakdown {
  shiftId: string;
  openedAt: string;
  status: string;
  floatIn: number;
  cashSales: number;
  cashRefunds: number;
  paidOut: number;
  dropped: number;
  derived: number;
  expected: number;
  drift: number;
  cardSales: number;
  movements: number;
}

export interface QueuedPayment {
  bookingId: string;
  ref: string;
  orderId: string;
  orderRef: string;
  engineKind: EngineKind;
  productName: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  items: number;
  createdAt: string;
  waitingMs: number;
  subtotal: number;
  vat: number;
  depositTotal: number;
  discountOff?: number;
  total: number;
  orderStatus: string;
}

export interface TillTransaction {
  _id: string;
  amount: number;
  method: PaymentMethod;
  kind: string;
  status: "PENDING" | "CAPTURED" | "REFUNDED";
  createdAt: string;
  orderId: string;
  bookingId: string | null;
  bookingRef: string;
  customerName: string;
  productName: string;
  engineKind: EngineKind | null;
  receiptRef: string | null;
  takenBy: string;
  takenByName: string;
}

export interface TillOverview {
  shift: {
    _id: string;
    status: string;
    openedAt: string;
    expectedCash: number;
  } | null;
  drawer: DrawerBreakdown | null;
  queue: { count: number; value: number; oldestWaitingMs: number };
  today: {
    transactions: number;
    gross: number;
    refunded: number;
    net: number;
    cash: number;
    card: number;
  };
  customers: number;
}

/* ---------- till ---------- */

export const tillApi = {
  overview: () => get<TillOverview>("/till/overview"),

  queue: () => get<QueuedPayment[]>("/till/queue"),

  transactions: (params?: {
    from?: string;
    to?: string;
    method?: PaymentMethod;
    kind?: string;
    shiftId?: string;
  }) => get<TillTransaction[]>("/till/transactions", params),

  drawer: (shiftId?: string) =>
    get<{ drawer: DrawerBreakdown | null; movements: CashMovement[] }>(
      "/till/drawer",
      shiftId ? { shiftId } : undefined,
    ),

  shift: () => get<{ shift: any }>("/till/shift"),

  movement: (input: {
    kind: CashMovementKind;
    amount: number;
    reason: string;
    reference?: string;
  }) => post<CashMovement>("/till/drawer/movement", input),

  refund: (paymentId: string, input: { amount: number; reason: string }) =>
    post<{ refund: TillTransaction; remaining: number }>(
      `/till/payments/${paymentId}/refund`,
      input,
    ),

  open: (openingFloat: number) =>
    post<{ shift: any; drawer: any }>("/till/open", { openingFloat }),

  close: (countedCash: number) =>
    post<{ shift: any; drawer: any }>("/till/close", { countedCash }),

  addMovement: (input: { type: string; amount: number; note?: string }) =>
    post<CashMovement>("/till/movement", input),
};

export type RefundRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface RefundRequest {
  _id: string;
  ref: string;
  bookingId: string;
  bookingRef: string;
  customerName: string;
  engineKind: EngineKind;
  amount: number;
  reason: string;
  requestedByName: string;
  createdAt: string;
  status: RefundRequestStatus;
  reviewedByName?: string;
  reviewedAt?: string;
}

export interface RefundRequestsResponse {
  rows: RefundRequest[];
  canApprove: boolean;
  pendingTotal: number;
}

export const refundRequestApi = {
  list: (params?: { status?: RefundRequestStatus }) =>
    get<RefundRequestsResponse>("/refund-requests", params),

  review: (id: string, input: { approve: boolean; note?: string }) =>
    post<RefundRequest>(`/refund-requests/${id}/review`, input),
};