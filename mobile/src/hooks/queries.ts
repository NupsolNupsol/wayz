// src/hooks/queries.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  bookingApi,
  catalogueApi,
  customerApi,
  dashboardApi,
  deliveryApi,
  incidentApi,
  shiftApi,
  tillApi,
  refundRequestApi,
  type RefundRequestStatus,
  type CreateBookingInput,
  type PaymentSplit,
  type TransitionPayload,
} from "@/api/endpoints";

import type { EngineKind } from "@/types";
import { qk } from "./querykeys.ts";

/* ---------- keys ---------- */

export const keys = {

  stats: ["stats"] as const,
  products: (engine?: EngineKind) => ["products", engine ?? "all"] as const,
  units: ["units"] as const,
  customers: (q: string) => ["customers", q] as const,
  customer: (id: string) => ["customer", id] as const,
  bookings: (filter: object) => ["bookings", filter] as const,
  booking: (id: string) => ["booking", id] as const,
  order: (id: string) => ["booking", id, "order"] as const,
  transitions: (id: string) => ["booking", id, "transitions"] as const,
  deliveries: (filter: object) => ["deliveries", filter] as const,
  delivery: (id: string) => ["delivery", id] as const,
  shift: ["shift"] as const,
  incidents: ["incidents"] as const,
  incidentCatalogue: ["incidents", "catalogue"] as const,
  till: {
    overview: ["till", "overview"] as const,
    queue: ["till", "queue"] as const,
    transactions: (params?: { from?: string; to?: string }) =>
      ["till", "transactions", params] as const,
    drawer: ["till", "drawer"] as const,
    movements: ["till", "movements"] as const,
    shift: ["till", "shift"] as const,
  },
};

const LIVE = 15_000;

/* ---------- existing queries ---------- */

export const useShift = (enabled = true) =>
  useQuery({
    queryKey: qk.shift,
    queryFn: () => shiftApi.current(),
    enabled,
  });

export const useStats = () =>
  useQuery({
    queryKey: keys.stats,
    queryFn: () => dashboardApi.stats(),
    refetchInterval: LIVE,
  });

export const useProducts = (engineKind?: EngineKind) =>

  useQuery({
    queryKey: keys.products(engineKind),
    queryFn: () => catalogueApi.products(engineKind),
  });

export const useUnits = () =>
  useQuery({ queryKey: keys.units, queryFn: catalogueApi.units });


export const useCustomers = (q: string) =>
  useQuery({
    queryKey: keys.customers(q),
    queryFn: () => customerApi.list(q || undefined),
  });

export const useCustomer = (id?: string) =>
  useQuery({
    queryKey: keys.customer(id ?? ""),
    queryFn: () => customerApi.get(id!),
    enabled: !!id,
  });

export const useBookings = (
  filter: { status?: string; engineKind?: EngineKind } = {},
) =>
  useQuery({
    queryKey: keys.bookings(filter),
    queryFn: () => bookingApi.list(filter),
    refetchInterval: LIVE,
  });

export const useBooking = (id?: string) =>
  useQuery({
    queryKey: keys.booking(id ?? ""),
    queryFn: () => bookingApi.get(id!),
    enabled: !!id,
  });

export const useOrder = (id?: string) =>
  useQuery({
    queryKey: keys.order(id ?? ""),
    queryFn: () => bookingApi.order(id!),
    enabled: !!id,
  });

export const useTransitions = (id?: string) =>
  useQuery({
    queryKey: keys.transitions(id ?? ""),
    queryFn: () => bookingApi.transitions(id!),
    enabled: !!id,
  });

export const useStationDeliveries = (
  filter: { status?: string; bookingId?: string } = {},
  enabled = true,
) =>
  useQuery({
    queryKey: keys.deliveries(filter),
    queryFn: () => deliveryApi.station(filter),
    enabled,
    refetchInterval: LIVE,
  });

export const useDelivery = (id?: string) =>
  useQuery({
    queryKey: keys.delivery(id ?? ""),
    queryFn: () => deliveryApi.get(id!),
    enabled: !!id,
    refetchInterval: 10_000,
  });

export const useIncidents = () =>
  useQuery({ queryKey: keys.incidents, queryFn: incidentApi.list });

export const useIncidentCatalogue = () =>
  useQuery({
    queryKey: keys.incidentCatalogue,
    queryFn: incidentApi.catalogue,
    staleTime: Infinity,
  });

/* ---------- till queries ---------- */

export function useTillOverview() {
  return useQuery({
    queryKey: keys.till.overview,
    queryFn: () => tillApi.overview(),
    staleTime: 60 * 1000,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useTillQueue() {
  return useQuery({
    queryKey: keys.till.queue,
    queryFn: () => tillApi.queue(),
    staleTime: 30 * 1000,
    refetchInterval: LIVE,
  });
}

export function useTillTransactions(params?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: keys.till.transactions(params),
    queryFn: () => tillApi.transactions(params),
    staleTime: 60 * 1000,
  });
}

export function useTillDrawer() {
  return useQuery({
    queryKey: keys.till.drawer,
    queryFn: () => tillApi.drawer(),
    staleTime: 60 * 1000,
  });
}

export function useTillMovements() {
  return useQuery({
    queryKey: keys.till.movements,
    queryFn: () => tillApi.movement,
    staleTime: 60 * 1000,
  });
}

export function useTillShift() {
  return useQuery({
    queryKey: keys.till.shift,
    queryFn: () => tillApi.shift(),
    staleTime: 60 * 1000,
  });
}

/* ---------- booking mutations ---------- */

function useBookingInvalidation() {
  const qc = useQueryClient();
  return (id?: string) => {
    if (id) {
      void qc.invalidateQueries({ queryKey: keys.booking(id) });
      void qc.invalidateQueries({ queryKey: ["booking", id] });
    }
    void qc.invalidateQueries({ queryKey: ["bookings"] });
    void qc.invalidateQueries({ queryKey: keys.stats });
    void qc.invalidateQueries({ queryKey: keys.units });
  };
}

export function useCreateBooking() {
  const refresh = useBookingInvalidation();
  return useMutation({
    mutationFn: (input: CreateBookingInput) => bookingApi.create(input),
    onSuccess: (result) => refresh(result.booking.id),
  });
}

export function usePay() {
  const refresh = useBookingInvalidation();
  return useMutation({
    mutationFn: ({ id, splits }: { id: string; splits: PaymentSplit[] }) =>
      bookingApi.pay(id, splits),
    onSuccess: (_r, v) => refresh(v.id),
  });
}

export function useReserve() {
  const refresh = useBookingInvalidation();
  return useMutation({
    mutationFn: ({ id, unitId }: { id: string; unitId?: string }) =>
      bookingApi.reserve(id, unitId),
    onSuccess: (_r, v) => refresh(v.id),
  });
}

export function useReassign() {
  const refresh = useBookingInvalidation();
  return useMutation({
    mutationFn: ({
      id,
      unitId,
      reason,
    }: {
      id: string;
      unitId: string;
      reason: string;
    }) => bookingApi.reassign(id, unitId, reason),
    onSuccess: (_r, v) => refresh(v.id),
  });
}

export function useScanOut() {
  const refresh = useBookingInvalidation();
  return useMutation({
    mutationFn: ({ id, barcode }: { id: string; barcode: string }) =>
      bookingApi.scanOut(id, barcode),
    onSuccess: (_r, v) => refresh(v.id),
  });
}

export function useTransition() {
  const refresh = useBookingInvalidation();
  return useMutation({
    mutationFn: ({
      id,
      code,
      payload,
    }: {
      id: string;
      code: string;
      payload?: TransitionPayload;
    }) => bookingApi.transition(id, code, payload),
    onSuccess: (_r, v) => refresh(v.id),
  });
}

export function useSendVerification() {
  return useMutation({
    mutationFn: ({
      id,
      channel,
    }: {
      id: string;
      channel: "WHATSAPP" | "EMAIL";
    }) => bookingApi.sendVerification(id, "RETRIEVAL", channel),
  });
}

export function useConfirmVerification() {
  const refresh = useBookingInvalidation();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Record<string, unknown>;
    }) => bookingApi.confirmVerification(id, input),
    onSuccess: (_r, v) => refresh(v.id),
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; phone: string; email?: string }) =>
      customerApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useCreateDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof deliveryApi.create>[0]) =>
      deliveryApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["deliveries"] }),
  });
}

export function useDeliveryTransition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      code,
      payload,
    }: {
      id: string;
      code: string;
      payload?: { compartmentCode?: string; reason?: string };
    }) => deliveryApi.stationTransition(id, code, payload),
    onSuccess: (_r, v) => {
      void qc.invalidateQueries({ queryKey: keys.delivery(v.id) });
      void qc.invalidateQueries({ queryKey: ["deliveries"] });
    },
  });
}

export function useOpenShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: shiftApi.open,
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.shift }),
  });
}

export function useBlindCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      countedCash,
    }: {
      id: string;
      countedCash: number;
    }) => shiftApi.blindCount(id, countedCash),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.shift }),
  });
}

export function useCreateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof incidentApi.create>[0]) =>
      incidentApi.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.incidents });
      void qc.invalidateQueries({ queryKey: keys.stats });
    },
  });
}

/* ---------- till mutations ---------- */

export function useOpenTill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (openingFloat: number) => tillApi.open(openingFloat),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.till.overview });
      void qc.invalidateQueries({ queryKey: keys.till.shift });
      void qc.invalidateQueries({ queryKey: keys.shift });
    },
  });
}

export function useCloseTill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (countedCash: number) => tillApi.close(countedCash),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.till.overview });
      void qc.invalidateQueries({ queryKey: keys.till.shift });
      void qc.invalidateQueries({ queryKey: keys.shift });
    },
  });
}

export function useAddTillMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { type: string; amount: number; note?: string }) =>
      tillApi.addMovement(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.till.overview });
      void qc.invalidateQueries({ queryKey: keys.till.movements });
      void qc.invalidateQueries({ queryKey: keys.till.drawer });
    },
  });
}

export function useRecordMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      kind: "FLOAT_IN" | "PAY_OUT" | "DROP";
      amount: number;
      reason: string;
      reference?: string;
    }) => tillApi.movement(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.till.drawer });
      void qc.invalidateQueries({ queryKey: keys.till.overview });
      void qc.invalidateQueries({ queryKey: keys.till.movements });
      void qc.invalidateQueries({ queryKey: keys.shift });
    },
  });
}

export function useRefundPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      paymentId,
      amount,
      reason,
    }: {
      paymentId: string;
      amount: number;
      reason: string;
    }) => tillApi.refund(paymentId, { amount, reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.till.transactions() });
      void qc.invalidateQueries({ queryKey: keys.till.overview });
      void qc.invalidateQueries({ queryKey: keys.till.queue });
    },
  });
}

export function useDiscountBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      reasonCode,
      percent,
      note,
    }: {
      id: string;
      reasonCode: string;
      percent: number;
      note?: string;
    }) => bookingApi.discount(id, { reasonCode, percent, note }),
    onSuccess: (_r, v) => {
      void qc.invalidateQueries({ queryKey: keys.booking(v.id) });
      void qc.invalidateQueries({ queryKey: ["bookings"] });
      void qc.invalidateQueries({ queryKey: keys.till.queue });
      void qc.invalidateQueries({ queryKey: keys.till.overview });
    },
  });
}

export function useRefundRequests(params?: { status?: RefundRequestStatus }) {
  return useQuery({
    queryKey: ["refund-requests", params ?? {}],
    queryFn: () => refundRequestApi.list(params),
  });
}

export function useReviewRefundRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      approve,
      note,
    }: {
      id: string;
      approve: boolean;
      note?: string;
    }) => refundRequestApi.review(id, { approve, note }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["refund-requests"] });
      void qc.invalidateQueries({ queryKey: keys.till.transactions() });
      void qc.invalidateQueries({ queryKey: keys.till.overview });
    },
  });
}