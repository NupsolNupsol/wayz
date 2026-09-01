import { http, unwrap } from './client'
import type { PublicTracking } from './types'

export const publicApi = {
  tracking: (token: string) => unwrap<PublicTracking>(http.get(`/public/tracking/${token}`)),
}

export function trackingUrl(trackingToken: string): string {
  return `${window.location.origin}/track/${trackingToken}`
}
