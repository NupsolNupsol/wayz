import { http, unwrap } from './client'

/**
 * Selling and running an activity the tenant defined for itself.
 *
 * The counter's half of the activity engine. Deliberately separate from `activity.api.ts`,
 * which is the authoring half: a manager writes the definition, an agent sells against it, and
 * neither endpoint set is reachable by the other's screens.
 */

export interface ActivityStep {
  key: string
  label: string
  labelAr: string
  to: string
}

export interface ActivitySessionState {
  state: { key: string; label: string; labelAr: string; terminal: boolean; inProgress: boolean } | null
  steps: ActivityStep[]
}

export interface OpenedSession {
  booking: {
    _id: string
    ref: string
    status: string
    totalAmount: number
    activity: { key: string; name: string; nameAr: string; revision: number } | null
  }
  order: { _id: string; ref: string; total: number }
}

export const activitySessionApi = {
  /** Opens a booking. Refused, in the tenant's own words, if their own rules say so. */
  open: (input: {
    activityKey: string
    customerId: string
    resourceId?: string | null
    values?: Record<string, unknown>
    quantity?: number
  }) => unwrap<OpenedSession>(http.post('/activities/sessions', input)),

  /** Where it stands, and where this person can take it from here. */
  steps: (bookingId: string) => unwrap<ActivitySessionState>(http.get(`/activities/sessions/${bookingId}/steps`)),

  /** One step along the activity's own workflow. */
  step: (bookingId: string, step: string, values?: Record<string, unknown>) =>
    unwrap<{ _id: string; status: string }>(http.post(`/activities/sessions/${bookingId}/steps`, { step, values })),
}
