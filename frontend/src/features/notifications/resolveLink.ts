import { can, isAccountantRole, isCourierRole, isHrRole, MANAGER_ROLES } from '@/permissions/permissions'
import type { Role } from '@/api/types'

const oversees = (role: Role) => MANAGER_ROLES.includes(role)

export function resolveNotificationLink(link: string | null | undefined, role: Role | undefined): string | null {
  if (!link || !role) return null

  const booking = /^\/bookings\/(.+)$/.exec(link)
  if (booking) {
    if (can(role, 'pos.use')) return link
    if (oversees(role)) return `/manager/rentals/${booking[1]}`
    return null
  }

  const delivery = /^\/deliveries\/(.+)$/.exec(link)
  if (delivery) {
    if (isCourierRole(role)) return `/courier/task/${delivery[1]}`
    if (can(role, 'delivery.request')) return `/deliveries?open=${delivery[1]}`
    return null
  }

  if (link.startsWith('/assets')) return can(role, 'assets.view') ? link : null
  if (link === '/refund-requests') return can(role, 'refund.request') || can(role, 'refund.approve') ? link : null
  if (link === '/manual-sales') return can(role, 'sales.enterManual') || can(role, 'sales.approveManual') ? link : null
  if (link === '/admin/rules') return can(role, 'rules.edit') ? link : null

  if (link === '/lagoon/trips') {
    if (can(role, 'trip.sail')) return '/lagoon/captain'
    return can(role, 'trip.plan') ? link : null
  }

  if (link === '/manager/incidents') {
    if (oversees(role)) return link
    return can(role, 'incident.report') ? '/incidents' : null
  }

  if (link === '/manager/shifts') {
    if (oversees(role)) return link
    return can(role, 'shift.blindCount') ? '/shift' : null
  }

  if (link.startsWith('/manager')) return oversees(role) ? link : null
  if (link.startsWith('/admin')) return can(role, 'tenant.administer') ? link : null
  if (link.startsWith('/accounting')) return isAccountantRole(role) || can(role, 'tenant.administer') ? link : null
  if (link.startsWith('/hr')) return isHrRole(role) || can(role, 'tenant.administer') ? link : null
  if (link.startsWith('/courier')) return isCourierRole(role) ? link : null

  return link
}
