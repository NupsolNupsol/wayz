/**
 * What a tenant is allowed to do, as data.
 *
 * This file exists to answer one question the platform is otherwise tempted to answer with
 * `if (tenant === 'WIQAR')`. That branch is the thing that makes a product single-customer:
 * it works for exactly the two companies somebody remembered to write down, and tenant
 * number seven needs a developer, a pull request and a deployment before it can sell
 * anything.
 *
 * So a tenant is described by the capabilities it holds and the profiles it enables, and
 * every screen asks about *those*. Adding a tenant that stores bags and rents scooters is
 * then the same operation as adding one that runs horse tours: choose from this list.
 *
 * Two rules keep it honest.
 *
 * A capability is a *thing the product can do*, never a customer's name. `ANIMALS` is a
 * capability; `WIQAR` would not be. If a key would read strangely for a third company that
 * happened to want it, it is the wrong key.
 *
 * A profile is a *job*, and its label is what that job is called on the floor. Two tenants
 * can enable the same profile and call it different things, because the label travels with
 * the tenant while the permissions travel with the profile.
 */

export interface CapabilityDef {
  key: string
  /** What it lets a tenant do, in the words an account manager would use selling it. */
  label: string
  labelAr: string
  blurb: string
  /** Grouped only for the sake of a readable form. */
  group: 'OPERATIONS' | 'DOMAIN' | 'BACK_OFFICE'
}

export const CAPABILITIES: CapabilityDef[] = [
  {
    key: 'POS',
    label: 'Point of sale',
    labelAr: 'نقطة البيع',
    blurb: 'Sell at a counter: customers, payments, invoices and receipts.',
    group: 'OPERATIONS',
  },
  {
    key: 'ACTIVITIES',
    label: 'Activities',
    labelAr: 'الأنشطة',
    blurb: 'Bookable activities the tenant defines and configures itself.',
    group: 'OPERATIONS',
  },
  {
    key: 'STORAGE',
    label: 'Bag storage',
    labelAr: 'تخزين الحقائب',
    blurb: 'Lockers held at gates, with storage runs and retrieval.',
    group: 'OPERATIONS',
  },
  {
    key: 'RENTALS',
    label: 'Vehicle rentals',
    labelAr: 'تأجير المركبات',
    blurb: 'Hire out numbered units by time, with overtime and replacements.',
    group: 'OPERATIONS',
  },
  {
    key: 'BOATS',
    label: 'Boats & trips',
    labelAr: 'القوارب والرحلات',
    blurb: 'Seat parties onto boats, group them into trips and sail them.',
    group: 'OPERATIONS',
  },
  {
    key: 'DELIVERY',
    label: 'Courier runs',
    labelAr: 'مهام المندوبين',
    blurb: 'Move goods between counters, gates and customers.',
    group: 'OPERATIONS',
  },
  {
    key: 'ANIMALS',
    label: 'Animal management',
    labelAr: 'إدارة الحيوانات',
    blurb: 'Animals as bookable resources: health, rest, sessions and transfers.',
    group: 'DOMAIN',
  },
  {
    key: 'INVENTORY',
    label: 'Inventory & procurement',
    labelAr: 'المخزون والمشتريات',
    blurb: 'Stock per location, reorder thresholds, purchase orders and receipts.',
    group: 'DOMAIN',
  },
  {
    key: 'RETAIL',
    label: 'Retail & F&B',
    labelAr: 'التجزئة والمطاعم',
    blurb: 'Shops, food and drink, and other over-the-counter selling.',
    group: 'DOMAIN',
  },
  {
    key: 'HR',
    label: 'People',
    labelAr: 'الموارد البشرية',
    blurb: 'Employees, contracts, shifts, attendance, overtime and leave.',
    group: 'BACK_OFFICE',
  },
  {
    key: 'FINANCE',
    label: 'Finance & reporting',
    labelAr: 'المالية والتقارير',
    blurb: 'Revenue, expenses, reconciliation, cost centres and reporting.',
    group: 'BACK_OFFICE',
  },
]

export const CAPABILITY_KEYS = CAPABILITIES.map((c) => c.key)

export interface ProfileDef {
  key: string
  label: string
  labelAr: string
  blurb: string
  /** The platform role this profile is served by. Permissions live with the role. */
  role: string
  /** Without these, the profile has nothing to do, so the form will not offer it. */
  requires: string[]
  /** Answers for one counter rather than the whole venue. */
  deskScoped?: boolean
}

/**
 * The jobs a tenant can staff.
 *
 * `requires` is what stops a tenant being offered a job it has no work for: a company that
 * never enabled boats should not be able to hire a captain, and a company that did should
 * not have to explain why the option is missing. It also stops the failure the client
 * called out — WAYZ's Shop & Drop and Lagoon roles appearing inside a tenant that runs
 * horse tours — without anybody writing that tenant's name down anywhere.
 */
export const PLATFORM_PROFILES: ProfileDef[] = [
  {
    key: 'TENANT_ADMIN',
    label: 'Tenant administrator',
    labelAr: 'مدير المنشأة',
    blurb: 'Owns the tenant: structure, staff, pricing, rules and activities.',
    role: 'TENANT_ADMIN',
    requires: [],
  },
  {
    key: 'PROJECT_MANAGER',
    label: 'Project manager',
    labelAr: 'مدير المشروع',
    blurb: 'Oversees every location and approves what managers escalate.',
    role: 'PROJECT_MANAGER',
    requires: [],
  },
  {
    key: 'MANAGER',
    label: 'Manager',
    labelAr: 'مدير',
    blurb: 'Runs one activity across the venue: people, assets and exceptions.',
    role: 'MANAGER',
    requires: [],
  },
  {
    key: 'SUPERVISOR',
    label: 'Supervisor',
    labelAr: 'مشرف',
    blurb: 'Floor lead: overrides, approvals and the day-to-day.',
    role: 'SUPERVISOR',
    requires: [],
  },
  {
    key: 'COUNTER_AGENT',
    label: 'Counter agent',
    labelAr: 'موظف نقطة بيع',
    blurb: 'Serves customers and takes money at one counter.',
    role: 'AGENT',
    requires: ['POS'],
    deskScoped: true,
  },
  {
    key: 'ACTIVITY_AGENT',
    label: 'Activity agent',
    labelAr: 'موظف الأنشطة',
    blurb: 'Books and runs the tenant’s activities at one counter.',
    role: 'AGENT',
    requires: ['ACTIVITIES'],
    deskScoped: true,
  },
  {
    key: 'STORAGE_AGENT',
    label: 'Bag drop agent',
    labelAr: 'موظف تخزين الحقائب',
    blurb: 'Takes bags in and arranges for them to be stored at a gate.',
    role: 'AGENT',
    requires: ['STORAGE'],
    deskScoped: true,
  },
  {
    key: 'RENTAL_AGENT',
    label: 'Rental agent',
    labelAr: 'موظف التأجير',
    blurb: 'Hands over and takes back vehicles at a bay.',
    role: 'AGENT',
    requires: ['RENTALS'],
    deskScoped: true,
  },
  {
    key: 'BOAT_AGENT',
    label: 'Jetty agent',
    labelAr: 'موظف الرصيف',
    blurb: 'Seats parties onto boats at a jetty.',
    role: 'AGENT',
    requires: ['BOATS'],
    deskScoped: true,
  },
  {
    key: 'CAPTAIN',
    label: 'Chief captain',
    labelAr: 'قائد الرحلات',
    blurb: 'Takes trips out and brings them back.',
    role: 'CHIEF_CAPTAIN',
    requires: ['BOATS'],
    deskScoped: true,
  },
  {
    key: 'COURIER',
    label: 'Delivery agent',
    labelAr: 'مندوب التوصيل',
    blurb: 'Carries goods between counters, gates and customers.',
    role: 'DELIVERY_AGENT',
    requires: ['DELIVERY'],
  },
  {
    key: 'ACCOUNTANT',
    label: 'Accountant',
    labelAr: 'محاسب',
    blurb: 'Reconciles the till, reports revenue and handles refunds.',
    role: 'ACCOUNTANT',
    requires: ['FINANCE'],
  },
  {
    key: 'HR',
    label: 'People officer',
    labelAr: 'مسؤول الموارد البشرية',
    blurb: 'Employees, contracts, attendance and costs.',
    role: 'HR',
    requires: ['HR'],
  },
]

export const PROFILE_KEYS = PLATFORM_PROFILES.map((p) => p.key)

/** The profiles a tenant holding these capabilities can actually staff. */
export function profilesAvailableFor(capabilities: string[]): ProfileDef[] {
  const held = new Set(capabilities)
  return PLATFORM_PROFILES.filter((p) => p.requires.every((c) => held.has(c)))
}
