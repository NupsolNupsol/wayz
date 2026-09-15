import type { Me, Role } from '@/types'

/**
 * Which app a signed-in person gets.
 *
 * The handhelds carry two workspaces — the counter and the road — and the role decides which one
 * opens. Everyone else (managers, accounting, HR) works on the web, and is told so rather than
 * being dropped into a counter they cannot use.
 */
export type Workspace = 'kiosk' | 'courier' | 'unsupported'

const KIOSK_ROLES: Role[] = ['AGENT', 'SUPERVISOR', 'LAGOON_WELCOME', 'CHIEF_CAPTAIN']
const COURIER_ROLES: Role[] = ['DELIVERY_AGENT']

export function workspaceFor(role: Role | undefined | null): Workspace {
  if (!role) return 'unsupported'
  if (COURIER_ROLES.includes(role)) return 'courier'
  if (KIOSK_ROLES.includes(role)) return 'kiosk'
  return 'unsupported'
}

export const homeFor = (role: Role | undefined | null): string => {
  switch (workspaceFor(role)) {
    case 'courier':
      return '/(courier)/runs'
    case 'kiosk':
      return '/(kiosk)/today'
    default:
      return '/no-workspace'
  }
}

/** "Bilal Al-Harbi" → "BA". Two letters is all a 44pt circle can hold. */
export function initialsOf(person: Pick<Me, 'fullName'> | null | undefined): string {
  const parts = (person?.fullName ?? '').trim().split(/\s+/).filter(Boolean)
  const first = parts[0]
  if (!first) return '··'
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined
  if (!last) return first.slice(0, 2).toUpperCase()
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
}

/** "Bilal Al-Harbi" → "Bilal", for a greeting that fits on one line. */
export function firstNameOf(person: Pick<Me, 'fullName'> | null | undefined): string {
  return (person?.fullName ?? '').trim().split(/\s+/)[0] || 'there'
}

export function greeting(now: Date = new Date()): string {
  const hour = now.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
