/**
 * WIQAR's business, as WIQAR's own requirements describe it.
 *
 * Everything here comes from the Ana'am Experience functional specification and from nowhere
 * else. It is **configuration that happens to live in the repository** — read once, at
 * provisioning, and written into WIQAR's own database, where its administrator then owns it.
 *
 * Two rules govern this file:
 *
 *   1. **Nothing outside WIQAR's provisioning imports it.** No generic screen, service or
 *      query may reach for it. If something needs WIQAR's vocabulary at runtime, it is reading
 *      the wrong thing — the tenant's database is the source of truth once provisioned.
 *   2. **It borrows nothing from WAYZ.** Not a role, not an activity, not an asset kind. The
 *      two companies share the platform's machinery and none of its business meaning.
 *
 * WAYZ has the equivalent of this file in its own seed. Tenant number three will have its own,
 * or none at all and an administrator who builds it through the screens.
 */

/* ------------------------------------------------------------------------------------ */
/* Where it operates — §3.1, §3.2                                                          */
/* ------------------------------------------------------------------------------------ */

export interface WiqarArea {
  key: string
  name: string
  nameAr: string
  description: string
}

/**
 * The service areas, replicated identically at each location.
 *
 * §3.2: "The structure below applies to South of 'Usfan and is replicated identically at
 * Al-Jihfa and Wadi al-Qahah."
 */
export const WIQAR_AREAS: WiqarArea[] = [
  {
    key: 'welcome_desk',
    name: 'Main Entrance & Welcome Desk',
    nameAr: 'المدخل الرئيسي ومكتب الاستقبال',
    description: 'Visitor registration, experience booking and general ticketing.',
  },
  {
    key: 'equestrian_track',
    name: 'Equestrian Track & Stable',
    nameAr: 'مضمار الفروسية والإسطبل',
    description: 'Horse riding sessions and horse care packages.',
  },
  {
    key: 'camel_paddock',
    name: 'Camel Paddock',
    nameAr: 'حظيرة الإبل',
    description: 'Guided camel tours and the camel interaction zone.',
  },
  {
    key: 'animal_village',
    name: 'Animal Village',
    nameAr: 'قرية الحيوانات',
    description: 'Goats, deer and other heritage animals; visitor feeding and photography.',
  },
  {
    key: 'photography_studio',
    name: 'Photography Studio',
    nameAr: 'استوديو التصوير',
    description: 'Professional camera setup; printed and digital packages.',
  },
  {
    key: 'shop_male',
    name: 'Changing Rooms — Male Shop',
    nameAr: 'غرف التبديل — متجر الرجال',
    description: 'Retail: equestrian accessories, memorabilia and care products.',
  },
  {
    key: 'shop_female',
    name: 'Changing Rooms — Female Shop',
    nameAr: 'غرف التبديل — متجر النساء',
    description: 'Separate retail shop for female visitors; same catalogue.',
  },
]

/** §3.2: three POS terminals per location — main entry, male shop, female shop. */
export interface WiqarTerminal {
  key: string
  name: string
  nameAr: string
  /** The area it stands in. */
  area: string
  /** Which activities it sells. Empty means everything the tenant publishes. */
  activities: string[]
  retailOnly: boolean
}

export const WIQAR_TERMINALS: WiqarTerminal[] = [
  {
    key: 'main_reception',
    name: 'Main Reception POS',
    nameAr: 'نقطة بيع الاستقبال',
    area: 'welcome_desk',
    activities: [],
    retailOnly: false,
  },
  {
    key: 'shop_male_pos',
    name: 'Male Shop POS',
    nameAr: 'نقطة بيع متجر الرجال',
    area: 'shop_male',
    activities: [],
    retailOnly: true,
  },
  {
    key: 'shop_female_pos',
    name: 'Female Shop POS',
    nameAr: 'نقطة بيع متجر النساء',
    area: 'shop_female',
    activities: [],
    retailOnly: true,
  },
]

export interface WiqarLocation {
  key: string
  name: string
  nameAr: string
  city: string
}

/** §3.1 — three locations under one season. */
export const WIQAR_LOCATIONS: WiqarLocation[] = [
  { key: 'usfan', name: "South of 'Usfan", nameAr: 'جنوب عسفان', city: 'Jeddah' },
  { key: 'jihfa', name: 'Al-Jihfa', nameAr: 'الجحفة', city: 'Jeddah' },
  { key: 'qahah', name: 'Wadi al-Qahah', nameAr: 'وادي القاحة', city: 'Jeddah' },
]

export const WIQAR_SITE = { name: 'Ala Khutah Season', nameAr: 'موسم على خطاه', city: 'Jeddah' }

/* ------------------------------------------------------------------------------------ */
/* What it works with — §7.1                                                               */
/* ------------------------------------------------------------------------------------ */

export interface WiqarResourceKind {
  key: string
  name: string
  nameAr: string
  /** How many of them exist, per the specification's current inventory. */
  countPerLocation: number
  /** The area they live in. */
  area: string
  identifierPrefix: string
}

/**
 * The animals, from §7.1.
 *
 * The specification gives estate-wide totals (30 horses, 18 camels, 23 goats) across three
 * identical locations, so they are divided between them. Deer are listed as "TBD" and are
 * seeded at a small number so the animal village is not empty.
 */
export const WIQAR_RESOURCE_KINDS: WiqarResourceKind[] = [
  { key: 'horse', name: 'Arabian Horse', nameAr: 'حصان عربي', countPerLocation: 10, area: 'equestrian_track', identifierPrefix: 'H' },
  { key: 'camel', name: 'Camel', nameAr: 'جمل', countPerLocation: 6, area: 'camel_paddock', identifierPrefix: 'C' },
  { key: 'goat', name: 'Goat', nameAr: 'ماعز', countPerLocation: 8, area: 'animal_village', identifierPrefix: 'G' },
  { key: 'deer', name: 'Deer', nameAr: 'غزال', countPerLocation: 4, area: 'animal_village', identifierPrefix: 'D' },
]

/* ------------------------------------------------------------------------------------ */
/* What it sells — §4.1                                                                    */
/* ------------------------------------------------------------------------------------ */

export interface WiqarActivity {
  key: string
  code: string
  name: string
  nameAr: string
  description: string
  emoji: string
  /** Minutes. The specification gives ranges; the upper bound is used as the slot length. */
  durationMin: number
  /** Indicative — §4 says all prices are subject to finalisation and must be editable. */
  price: number
  /** Which areas it runs in. */
  areas: string[]
  /** Which resource kinds it uses. Empty for activities that use none. */
  resourceKinds: string[]
  /** Which jobs may operate it. */
  operatorRoles: string[]
  /** Minimum party size, where the specification names one. */
  minParty: number
}

export const WIQAR_ACTIVITIES: WiqarActivity[] = [
  {
    key: 'arabian_horse_riding_tour',
    code: 'EXP-01',
    name: 'Arabian Horse Riding Tour',
    nameAr: 'جولة ركوب الخيل العربي',
    description: 'Guided trail ride on an Arabian horse with trainer escort; suitable for all skill levels.',
    emoji: '🐎',
    durationMin: 60,
    price: 250,
    areas: ['equestrian_track'],
    resourceKinds: ['horse'],
    operatorRoles: ['horse_trainer'],
    minParty: 1,
  },
  {
    key: 'equestrian_lessons',
    code: 'EXP-02',
    name: 'Equestrian Lessons',
    nameAr: 'دروس الفروسية',
    description: 'Structured riding lesson delivered by a certified horse trainer; beginner and intermediate.',
    emoji: '🏇',
    durationMin: 60,
    price: 300,
    areas: ['equestrian_track'],
    resourceKinds: ['horse'],
    operatorRoles: ['horse_trainer'],
    minParty: 1,
  },
  {
    key: 'camel_tour',
    code: 'EXP-03',
    name: 'Camel Tour',
    nameAr: 'جولة الإبل',
    description: 'Guided camel walk within the location grounds; a traditional heritage experience.',
    emoji: '🐫',
    durationMin: 30,
    price: 180,
    areas: ['camel_paddock'],
    resourceKinds: ['camel'],
    operatorRoles: ['camel_responsible'],
    minParty: 1,
  },
  {
    key: 'animal_care_pack_horse',
    code: 'EXP-04',
    name: 'Animal Care Pack — Horse',
    nameAr: 'باقة العناية بالحصان',
    description: 'The visitor grooms and showers their assigned horse, with trainer guidance and a brushing kit.',
    emoji: '🧼',
    durationMin: 30,
    price: 150,
    areas: ['equestrian_track'],
    resourceKinds: ['horse'],
    operatorRoles: ['animal_care_responsible', 'horse_trainer'],
    minParty: 1,
  },
  {
    key: 'animal_feeding_session',
    code: 'EXP-05',
    name: 'Animal Feeding Session',
    nameAr: 'جلسة إطعام الحيوانات',
    description: 'The visitor buys feed and feeds horses, camels or goats under supervision.',
    emoji: '🌾',
    durationMin: 15,
    price: 60,
    areas: ['animal_village'],
    resourceKinds: ['goat', 'camel', 'horse'],
    operatorRoles: ['animal_worker', 'animal_care_responsible'],
    minParty: 1,
  },
  {
    key: 'professional_photo_session',
    code: 'EXP-06',
    name: 'Professional Photo Session',
    nameAr: 'جلسة تصوير احترافية',
    description: 'Studio photography with the animals; digital delivery and printed packages.',
    emoji: '📸',
    durationMin: 20,
    price: 200,
    areas: ['photography_studio'],
    resourceKinds: [],
    operatorRoles: ['cashier_receptionist'],
    minParty: 1,
  },
  {
    key: 'group_package',
    code: 'EXP-07',
    name: 'Group Package',
    nameAr: 'الباقة الجماعية',
    description: 'Combined experience for groups: camel tour, animal feeding and a photo session.',
    emoji: '👥',
    durationMin: 90,
    price: 400,
    areas: ['welcome_desk', 'camel_paddock', 'animal_village', 'photography_studio'],
    resourceKinds: ['camel'],
    operatorRoles: ['cashier_receptionist', 'supervisor'],
    minParty: 5,
  },
]

/* ------------------------------------------------------------------------------------ */
/* Retail and stock — §4.2, §8.1                                                           */
/* ------------------------------------------------------------------------------------ */

export interface WiqarProduct {
  key: string
  name: string
  nameAr: string
  category: string
  price: number
}

/** §4.2 — the changing-room shops. */
export const WIQAR_RETAIL: WiqarProduct[] = [
  { key: 'riding_helmet', name: 'Riding Helmet', nameAr: 'خوذة ركوب', category: 'Equestrian accessories', price: 180 },
  { key: 'riding_gloves', name: 'Riding Gloves', nameAr: 'قفازات ركوب', category: 'Equestrian accessories', price: 75 },
  { key: 'saddle_pad', name: 'Saddle Pad', nameAr: 'بطانة سرج', category: 'Equestrian accessories', price: 140 },
  { key: 'grooming_kit', name: 'Grooming Kit', nameAr: 'طقم عناية', category: 'Animal care products', price: 120 },
  { key: 'halter', name: 'Halter', nameAr: 'رسن', category: 'Animal care products', price: 90 },
  { key: 'heritage_scarf', name: 'Heritage Scarf', nameAr: 'وشاح تراثي', category: 'Heritage memorabilia', price: 65 },
  { key: 'calligraphic_print', name: 'Calligraphic Print', nameAr: 'لوحة خط عربي', category: 'Heritage memorabilia', price: 110 },
  { key: 'keepsake_frame', name: 'Keepsake Frame', nameAr: 'إطار تذكاري', category: 'Photography packages', price: 95 },
  { key: 'printed_photo', name: 'Printed Photo', nameAr: 'صورة مطبوعة', category: 'Photography packages', price: 45 },
  { key: 'visitor_feed_pack', name: 'Visitor Feed Pack', nameAr: 'كيس علف للزوار', category: 'Animal food (retail)', price: 25 },
]

/** §8.1 — what is held, and how it is tracked. */
export const WIQAR_INVENTORY_CATEGORIES = [
  { key: 'animal_feed', name: 'Animal Feed', nameAr: 'علف الحيوانات' },
  { key: 'veterinary_supplies', name: 'Veterinary Supplies', nameAr: 'المستلزمات البيطرية' },
  { key: 'riding_equipment', name: 'Riding Equipment', nameAr: 'معدات الركوب' },
  { key: 'retail_merchandise', name: 'Retail Merchandise', nameAr: 'بضائع التجزئة' },
  { key: 'photography_consumables', name: 'Photography Consumables', nameAr: 'مستهلكات التصوير' },
  { key: 'operational_supplies', name: 'Operational Supplies', nameAr: 'اللوازم التشغيلية' },
]

/* ------------------------------------------------------------------------------------ */
/* How the money is grouped — §9.2                                                         */
/* ------------------------------------------------------------------------------------ */

/**
 * WIQAR's revenue streams.
 *
 * The dimensions its financial reporting groups by — not WAYZ's three engines. A WIQAR
 * accountant's dashboard is built from these.
 */
export const WIQAR_REVENUE_STREAMS = [
  { key: 'experiences', name: 'Experience packages', nameAr: 'باقات التجارب' },
  { key: 'retail', name: 'Retail sales', nameAr: 'مبيعات التجزئة' },
  { key: 'groups', name: 'Group bookings', nameAr: 'الحجوزات الجماعية' },
  { key: 'transfers', name: 'Inter-location transfers', nameAr: 'التحويلات بين المواقع' },
]

/** §7.3 — where an animal can be in its day. */
export const WIQAR_ANIMAL_STATUSES = [
  'AVAILABLE',
  'IN_SESSION',
  'RESTING',
  'UNDER_VETERINARY_CARE',
  'TRANSFERRED',
  'RETIRED',
] as const

/** §11.1 — an animal rests after working. Minutes, per species. */
export const WIQAR_REST_MINUTES: Record<string, number> = {
  horse: 30,
  camel: 45,
  goat: 15,
  deer: 15,
}
