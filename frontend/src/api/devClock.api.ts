import { http, unwrap } from './client'

export interface AgedBooking {
  id: string
  ref: string
  agedByMin: number
  startedAt: string | null
  expectedEndAt: string | null
}

export const devClockApi = {
  status: () => unwrap<{ enabled: boolean }>(http.get('/dev-clock/status')),
  age: (id: string, minutes: number) => unwrap<AgedBooking>(http.post(`/dev-clock/bookings/${id}/age`, { minutes })),
}
