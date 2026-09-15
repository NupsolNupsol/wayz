import { get, post } from '@/api/client'

import type { CourierBoard, CourierTransitionPayload, Delivery, DeliveryDetail } from './types'

/** Every call the courier workspace makes. Transport only — no react-query, no state. */
export const courierApi = {
  board: () => get<CourierBoard>('/deliveries/courier/board'),

  detail: (id: string) => get<DeliveryDetail>(`/deliveries/${id}`),

  transition: (id: string, code: string, payload?: CourierTransitionPayload) =>
    post<Delivery>(`/deliveries/courier/${id}/transition`, { code, payload: payload ?? {} }),

  /** Multi-stop runs are collected desk by desk; a single-stop run uses TO_PICKED_UP instead. */
  collectStop: (id: string, scannedBarcodes: string[]) =>
    post<Delivery>(`/deliveries/courier/${id}/collect-stop`, { scannedBarcodes }),
}
