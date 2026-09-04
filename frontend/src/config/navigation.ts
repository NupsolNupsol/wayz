import type { Permission } from '@/permissions/permissions'
import type { EngineKind } from '@/models'

export interface NavItem {
  id: string
  label: string
  to: string
  icon: string
  permission?: Permission
  engineKind?: EngineKind
  testId: string
}
export interface NavGroup {
  id: string
  label: string
  items: NavItem[]
}

export const MANAGER_NAV: NavGroup[] = [
  {
    id: 'manager-overview',
    label: 'Overview',
    items: [
      { id: 'mgr-overview', label: 'Dashboard', to: '/manager', icon: 'LayoutDashboard', testId: 'nav-mgr-overview' },
      { id: 'mgr-live', label: 'Live sessions', to: '/manager/live', icon: 'Activity', testId: 'nav-mgr-live' },
    ],
  },
  {
    id: 'manager-operations',
    label: 'Operations',
    items: [
      { id: 'mgr-rentals', label: 'Rentals', to: '/manager/rentals', icon: 'CalendarCheck', testId: 'nav-mgr-rentals' },
      { id: 'mgr-customers', label: 'Customers', to: '/manager/customers', icon: 'Users', testId: 'nav-mgr-customers' },
      { id: 'mgr-payments', label: 'Payments', to: '/manager/payments', icon: 'Banknote', testId: 'nav-mgr-payments' },
      { id: 'mgr-incidents', label: 'Incidents', to: '/manager/incidents', icon: 'TriangleAlert', testId: 'nav-mgr-incidents' },
      { id: 'mgr-shifts', label: 'Shifts & cash', to: '/manager/shifts', icon: 'Clock', testId: 'nav-mgr-shifts' },
      { id: 'mgr-till', label: 'Till & drawer', to: '/till', icon: 'Wallet', permission: 'till.operate', testId: 'nav-mgr-till' },
      { id: 'mgr-manual-sales', label: 'Manual sales', to: '/manual-sales', icon: 'FilePlus2', permission: 'sales.enterManual', testId: 'nav-mgr-manual-sales' },
      { id: 'mgr-refunds', label: 'Refund approvals', to: '/refund-requests', icon: 'Undo2', permission: 'refund.approve', testId: 'nav-mgr-refunds' },
    ],
  },
  {
    id: 'manager-admin',
    label: 'Administration',
    items: [
      { id: 'mgr-org', label: 'Organisation', to: '/manager/organisation', icon: 'Building2', testId: 'nav-mgr-org', permission: 'manager.configure' },
      { id: 'mgr-estate', label: 'Assets', to: '/assets', icon: 'Grid3x3', testId: 'nav-mgr-estate' },
      { id: 'mgr-pricing', label: 'Pricing', to: '/manager/pricing', icon: 'Tag', testId: 'nav-mgr-pricing', permission: 'pricing.edit' },
      { id: 'mgr-team', label: 'Team', to: '/manager/team', icon: 'UserCog', testId: 'nav-mgr-team', permission: 'manager.configure' },
      { id: 'mgr-settings', label: 'Settings', to: '/manager/settings', icon: 'Settings', testId: 'nav-mgr-settings', permission: 'manager.configure' },
      { id: 'mgr-rules', label: 'Operating rules', to: '/admin/rules', icon: 'Gavel', testId: 'nav-mgr-rules', permission: 'rules.edit' },
    ],
  },
  {
    id: 'manager-insight',
    label: 'Insight',
    items: [
      { id: 'mgr-reports', label: 'Reports', to: '/manager/reports', icon: 'ChartLine', testId: 'nav-mgr-reports' },
      { id: 'mgr-activity', label: 'Activity log', to: '/manager/activity', icon: 'ScrollText', testId: 'nav-mgr-activity' },
    ],
  },
  {
    id: 'help',
    label: 'Help & docs',
    items: [
      { id: 'manual', label: 'User manual', to: '/help/manual', icon: 'BookOpen', testId: 'nav-manual' },
    ],
  },
]

export const ACCOUNTANT_NAV: NavGroup[] = [
  {
    id: 'accounting-reporting',
    label: 'Reporting',
    items: [
      { id: 'accounting-dashboard', label: 'VAT & activities', to: '/accounting', icon: 'ChartLine', testId: 'nav-accounting-dashboard' },
      { id: 'accounting-commissions', label: 'Card commissions', to: '/accounting/commissions', icon: 'Percent', testId: 'nav-accounting-commissions' },
    ],
  },
  {
    id: 'accounting-settlement',
    label: 'Settlement',
    items: [
      { id: 'accounting-reconciliation', label: 'Reconciliation', to: '/accounting/settlement', icon: 'Scale', testId: 'nav-accounting-reconciliation' },
      { id: 'accounting-transactions', label: 'Transactions', to: '/accounting/settlement/transactions', icon: 'CreditCard', testId: 'nav-accounting-transactions' },
      { id: 'accounting-payments', label: 'Payments', to: '/accounting/settlement/payments', icon: 'Banknote', testId: 'nav-accounting-payments' },
      { id: 'accounting-manual', label: 'Manual sales', to: '/manual-sales', icon: 'FilePlus2', permission: 'sales.enterManual', testId: 'nav-accounting-manual' },
    ],
  },
  {
    id: 'accounting-session',
    label: 'Session',
    items: [{ id: 'accounting-profile', label: 'Profile', to: '/accounting/profile', icon: 'UserCog', testId: 'nav-accounting-profile' }],
  },
  {
    id: 'help',
    label: 'Help & docs',
    items: [
      { id: 'manual', label: 'User manual', to: '/help/manual', icon: 'BookOpen', testId: 'nav-manual' },
    ],
  },
]

export const HR_NAV: NavGroup[] = [
  {
    id: 'hr-costs',
    label: 'Costs',
    items: [
      { id: 'hr-overview', label: 'Costs', to: '/hr', icon: 'Receipt', testId: 'nav-hr-overview' },
      { id: 'hr-seasons', label: 'Seasons & payroll', to: '/hr/seasons', icon: 'CalendarRange', testId: 'nav-hr-seasons' },
      { id: 'hr-shifts', label: 'Shifts & hours', to: '/hr/shifts', icon: 'Clock', testId: 'nav-hr-shifts' },
      { id: 'hr-pricing', label: 'Pricing', to: '/hr/pricing', icon: 'Tag', permission: 'pricing.edit', testId: 'nav-hr-pricing' },
    ],
  },
  {
    id: 'hr-estate',
    label: 'Estate',
    items: [{ id: 'hr-assets', label: 'Assets', to: '/assets', icon: 'Grid3x3', testId: 'nav-hr-assets' }],
  },
  {
    id: 'hr-session',
    label: 'Session',
    items: [{ id: 'hr-profile', label: 'Profile', to: '/hr/profile', icon: 'UserCog', testId: 'nav-hr-profile' }],
  },
  {
    id: 'help',
    label: 'Help & docs',
    items: [
      { id: 'manual', label: 'User manual', to: '/help/manual', icon: 'BookOpen', testId: 'nav-manual' },
    ],
  },
]

export const TENANT_ADMIN_NAV: NavGroup[] = [
  {
    id: 'admin-tenant',
    label: 'My company',
    items: [
      { id: 'admin-overview', label: 'Overview', to: '/admin', icon: 'LayoutDashboard', testId: 'nav-admin-overview' },
      { id: 'admin-company', label: 'Company & branding', to: '/admin/company', icon: 'Building2', testId: 'nav-admin-company' },
      { id: 'admin-rules', label: 'Operating rules', to: '/admin/rules', icon: 'Gavel', testId: 'nav-admin-rules' },
      { id: 'admin-isolation', label: 'Data & isolation', to: '/admin/isolation', icon: 'Blocks', testId: 'nav-admin-isolation' },
    ],
  },
  {
    id: 'admin-estate',
    label: 'Estate',
    items: [
      { id: 'admin-org', label: 'Sites & stations', to: '/manager/organisation', icon: 'MapPin', testId: 'nav-admin-org' },
      { id: 'admin-stations', label: 'Station map', to: '/admin/stations', icon: 'Map', testId: 'nav-admin-stations' },
      { id: 'admin-assets', label: 'All assets', to: '/assets', icon: 'Grid3x3', testId: 'nav-admin-assets' },
      { id: 'admin-pricing', label: 'Pricing', to: '/manager/pricing', icon: 'Tag', testId: 'nav-admin-pricing' },
    ],
  },
  {
    id: 'admin-people',
    label: 'People',
    items: [
      { id: 'admin-team', label: 'Employees, accounts & roles', to: '/manager/team', icon: 'Users', testId: 'nav-admin-team' },
    ],
  },
  {
    id: 'admin-operations',
    label: 'Operations',
    items: [
      { id: 'admin-live', label: 'Live sessions', to: '/manager/live', icon: 'Activity', testId: 'nav-admin-live' },
      { id: 'admin-rentals', label: 'Rentals', to: '/manager/rentals', icon: 'CalendarCheck', testId: 'nav-admin-rentals' },
      { id: 'admin-customers', label: 'Customers', to: '/manager/customers', icon: 'Users', testId: 'nav-admin-customers' },
      { id: 'admin-payments', label: 'Payments', to: '/manager/payments', icon: 'Banknote', testId: 'nav-admin-payments' },
      { id: 'admin-incidents', label: 'Incidents', to: '/manager/incidents', icon: 'TriangleAlert', testId: 'nav-admin-incidents' },
      { id: 'admin-shifts', label: 'Shifts & cash', to: '/manager/shifts', icon: 'Clock', testId: 'nav-admin-shifts' },
    ],
  },
  {
    id: 'admin-insight',
    label: 'Insight',
    items: [
      { id: 'admin-reports', label: 'Reports', to: '/manager/reports', icon: 'ChartLine', testId: 'nav-admin-reports' },
      { id: 'admin-accounting', label: 'VAT & finance', to: '/accounting', icon: 'ChartLine', testId: 'nav-admin-accounting' },
      { id: 'admin-costs', label: 'Costs & seasons', to: '/hr', icon: 'Receipt', testId: 'nav-admin-costs' },
      { id: 'admin-commissions', label: 'Card commissions', to: '/accounting/commissions', icon: 'Percent', testId: 'nav-admin-commissions' },
      { id: 'admin-manual-sales', label: 'Manual sales', to: '/manual-sales', icon: 'FilePlus2', testId: 'nav-admin-manual-sales' },
      { id: 'admin-refunds', label: 'Refund approvals', to: '/refund-requests', icon: 'Undo2', testId: 'nav-admin-refunds' },
      { id: 'admin-audit', label: 'Audit trail', to: '/admin/audit', icon: 'ScrollText', testId: 'nav-admin-audit' },
    ],
  },
  {
    id: 'help',
    label: 'Help & docs',
    items: [
      { id: 'manual', label: 'User manual', to: '/help/manual', icon: 'BookOpen', testId: 'nav-manual' },
    ],
  },
]

export const COURIER_NAV: NavGroup[] = [
  {
    id: 'courier-work',
    label: 'My work',
    items: [
      { id: 'courier-board', label: 'Delivery board', to: '/courier', icon: 'Truck', testId: 'nav-courier-board' },
      { id: 'courier-history', label: 'Completed', to: '/courier/history', icon: 'PackageCheck', testId: 'nav-courier-history' },
      { id: 'courier-shift', label: 'My drawer', to: '/courier/shift', icon: 'Clock', testId: 'nav-courier-shift' },
    ],
  },
  {
    id: 'courier-session',
    label: 'Session',
    items: [{ id: 'courier-profile', label: 'Profile', to: '/courier/profile', icon: 'UserCog', testId: 'nav-courier-profile' }],
  },
  {
    id: 'help',
    label: 'Help & docs',
    items: [
      { id: 'manual', label: 'User manual', to: '/help/manual', icon: 'BookOpen', testId: 'nav-manual' },
    ],
  },
]

export const AGENT_NAV: NavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [{ id: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: 'LayoutDashboard', testId: 'nav-dashboard' }],
  },
  {
    id: 'sell',
    label: 'Sell',
    items: [
      { id: 'pos', label: 'New Transaction', to: '/pos', icon: 'CirclePlus', permission: 'pos.use', testId: 'nav-pos' },
    ],
  },
  {
    id: 'engines',
    label: 'Engines',
    items: [
      { id: 'shopdrop', label: 'Shop & Drop', to: '/shop-drop', icon: 'ShoppingBag', engineKind: 'SHOP_AND_DROP', permission: 'pos.use', testId: 'nav-shopdrop' },
      { id: 'mobility', label: 'Mobility Rentals', to: '/mobility', icon: 'Bike', engineKind: 'MOBILITY', permission: 'pos.use', testId: 'nav-mobility' },
      { id: 'lagoon', label: 'Lagoon', to: '/lagoon', icon: 'Sailboat', engineKind: 'LAGOON', permission: 'pos.use', testId: 'nav-lagoon' },
      { id: 'lagoon-trips', label: 'Boats & trips', to: '/lagoon/trips', icon: 'Ship', engineKind: 'LAGOON', permission: 'trip.plan', testId: 'nav-lagoon-trips' },
      { id: 'lagoon-captain', label: 'My trips', to: '/lagoon/captain', icon: 'Anchor', engineKind: 'LAGOON', permission: 'trip.sail', testId: 'nav-lagoon-captain' },
      { id: 'lagoon-voyage', label: 'Chart & sail', to: '/lagoon/voyage', icon: 'Map', engineKind: 'LAGOON', permission: 'trip.sail', testId: 'nav-lagoon-voyage' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { id: 'active', label: 'Active Operations', to: '/operations', icon: 'Activity', testId: 'nav-operations' },
      { id: 'deliveries', label: 'Deliveries', to: '/deliveries', icon: 'Truck', permission: 'delivery.request', testId: 'nav-deliveries' },
      { id: 'assets', label: 'Assets', to: '/assets', icon: 'Grid3x3', permission: 'assets.view', testId: 'nav-assets' },
      { id: 'incidents', label: 'Incidents', to: '/incidents', icon: 'TriangleAlert', permission: 'incident.report', testId: 'nav-incidents' },
    ],
  },
  {
    id: 'till',
    label: 'Till',
    items: [
      { id: 'till-overview', label: 'Till', to: '/till', icon: 'Wallet', permission: 'till.operate', testId: 'nav-till-overview' },
      { id: 'till-queue', label: 'Awaiting payment', to: '/till/queue', icon: 'ClipboardCheck', permission: 'till.operate', testId: 'nav-till-queue' },
      { id: 'till-transactions', label: 'Transactions', to: '/till/transactions', icon: 'Receipt', permission: 'till.operate', testId: 'nav-till-transactions' },
      { id: 'till-drawer', label: 'Cash drawer', to: '/till/drawer', icon: 'Banknote', permission: 'till.operate', testId: 'nav-till-drawer' },
      { id: 'till-refunds', label: 'Refund requests', to: '/refund-requests', icon: 'Undo2', permission: 'refund.request', testId: 'nav-till-refunds' },
    ],
  },
  {
    id: 'records',
    label: 'Records',
    items: [
      { id: 'customers', label: 'Customers', to: '/customers', icon: 'Users', permission: 'customer.manage', testId: 'nav-customers' },
      { id: 'bookings', label: 'Bookings', to: '/bookings', icon: 'CalendarCheck', testId: 'nav-bookings' },
    ],
  },
  {
    id: 'session',
    label: 'Session',
    items: [
      { id: 'shift', label: 'Shift', to: '/shift', icon: 'Clock', permission: 'shift.blindCount', testId: 'nav-shift' },
      { id: 'profile', label: 'Profile', to: '/profile', icon: 'UserCog', testId: 'nav-profile' },
    ],
  },
  {
    id: 'help',
    label: 'Help & docs',
    items: [
      { id: 'manual', label: 'User manual', to: '/help/manual', icon: 'BookOpen', testId: 'nav-manual' },
    ],
  },
]
