/**
 * The manual's shape. Every word lives in the manual namespace, so the whole book
 * reads in whichever language the user picked.
 */
export interface ManualSection {
  id: string
  route?: string
  icon: string
  steps?: number
  rules?: number
  tips?: number
}

export interface ManualGroup {
  id: string
  sections: ManualSection[]
}

export const MANUAL_GROUPS: ManualGroup[] = [
  {
    id: 'getting-started',
    sections: [
      { id: 'signing-in', icon: 'LogIn', steps: 3, tips: 2 },
      { id: 'dashboard', route: '/dashboard', icon: 'LayoutDashboard', steps: 3, tips: 1 },
    ],
  },
  {
    id: 'selling',
    sections: [
      { id: 'pos', route: '/pos', icon: 'CirclePlus', steps: 1, tips: 1 },
      { id: 'shop-drop', route: '/shop-drop', icon: 'ShoppingBag', steps: 6, rules: 3, tips: 1 },
      { id: 'engines', route: '/mobility', icon: 'Bike', steps: 4, rules: 2, tips: 1 },
    ],
  },
  {
    id: 'during',
    sections: [
      { id: 'operations', route: '/operations', icon: 'Activity', steps: 2, tips: 1 },
      { id: 'overtime', icon: 'Clock', steps: 3, rules: 2, tips: 2 },
      { id: 'tracking', icon: 'QrCode', steps: 2, rules: 2 },
    ],
  },
  {
    id: 'handback',
    sections: [
      { id: 'booking-detail', route: '/bookings', icon: 'CalendarCheck', steps: 3, tips: 1 },
      { id: 'verification', icon: 'ShieldCheck', steps: 4, rules: 4 },
      { id: 'retrieval', icon: 'PackageOpen', steps: 3, rules: 2 },
    ],
  },
  {
    id: 'cashier',
    sections: [
      { id: 'cashier-till', route: '/cashier', icon: 'Wallet', steps: 4, rules: 3, tips: 2 },
      { id: 'cashier-queue', route: '/cashier/queue', icon: 'ClipboardCheck', steps: 4, rules: 2 },
      { id: 'cashier-transactions', route: '/cashier/transactions', icon: 'Receipt', steps: 2, rules: 4 },
      { id: 'cashier-drawer', route: '/cashier/drawer', icon: 'Banknote', steps: 3, rules: 3 },
    ],
  },
  {
    id: 'delivery',
    sections: [
      { id: 'deliveries', route: '/deliveries', icon: 'Truck', steps: 5, rules: 5, tips: 2 },
      { id: 'courier-board', route: '/courier', icon: 'PackageCheck', steps: 5, rules: 4, tips: 3 },
    ],
  },
  {
    id: 'exceptions',
    sections: [
      { id: 'incidents', route: '/incidents', icon: 'TriangleAlert', steps: 3, tips: 1 },
      { id: 'assets', route: '/assets', icon: 'Grid3x3', steps: 5, rules: 3, tips: 3 },
    ],
  },
  {
    id: 'records',
    sections: [
      { id: 'customers', route: '/customers', icon: 'Users', steps: 2 },
      { id: 'bookings', route: '/bookings', icon: 'CalendarCheck', steps: 2 },
      { id: 'shift', route: '/shift', icon: 'Clock', steps: 3 },
      { id: 'profile', route: '/profile', icon: 'UserCog' },
    ],
  },
  {
    id: 'hr',
    sections: [
      { id: 'hr-costs', route: '/hr', icon: 'Receipt', steps: 4, rules: 4, tips: 2 },
      { id: 'hr-seasons', route: '/hr/seasons', icon: 'CalendarRange', steps: 3, rules: 3 },
    ],
  },
  {
    id: 'accounting',
    sections: [
      { id: 'accounting-dashboard', route: '/accounting', icon: 'ChartLine', steps: 4, rules: 4, tips: 2 },
      { id: 'accounting-commissions', route: '/accounting/commissions', icon: 'Percent', steps: 3, rules: 4 },
      { id: 'accounting-reconciliation', route: '/accounting/settlement', icon: 'Scale', steps: 3, rules: 3 },
      { id: 'accounting-payments', route: '/accounting/settlement/payments', icon: 'Banknote', steps: 2, rules: 2 },
      { id: 'accounting-transactions', route: '/accounting/settlement/transactions', icon: 'CreditCard', steps: 3, rules: 4, tips: 1 },
    ],
  },
]

const SECTION_IDS = new Set(MANUAL_GROUPS.flatMap((g) => g.sections.map((s) => s.id)))

/** Whether a screen has a page in the manual, so the header only offers help that exists. */
export function hasManualSection(id: string): boolean {
  return SECTION_IDS.has(id)
}
