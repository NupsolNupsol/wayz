import { create } from 'zustand'
import { useAuthStore } from '@/store/auth'

export interface ReceiptSlip {
  bookingId: string
  trackingToken?: string
}

interface ReceiptState {
  slip: ReceiptSlip | null
  show: (slip: ReceiptSlip) => void
  clear: () => void
}

export const useReceiptStore = create<ReceiptState>((set) => ({
  slip: null,
  show: (slip) => set({ slip }),
  clear: () => set({ slip: null }),
}))

/**
 * Every payment path ends here. Whether paper actually comes out is the tenant's call
 * (Organisation → settings → autoPrintReceipt), not the desk's and not ours.
 */
export function receiptAfterPayment(slip: ReceiptSlip) {
  if (useAuthStore.getState().me?.tenant?.autoPrintReceipt === false) return
  useReceiptStore.getState().show(slip)
}
