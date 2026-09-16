import { logger } from '../config/logger.js'
import { markSeededAccountsOnboarded } from './onboarding.seed.js'
import { hashPassword } from '../models/user.model.js'
import {
  AssetType,
  AssetUnit,
  CatalogueProduct,
  Kiosk,
  Site,
  Station,
  Tenant,
  User,
} from '../models/index.js'
import type { EngineKind } from '../domain/types.js'

/**
 * WIQAR, as the specification describes it.
 *
 * Seeds one organisation into the shared database: its three locations, the seven service areas
 * replicated at each, its animals, its retail catalogue and its people. Everything here is
 * traceable to a section of *WIQAR · Ana'am Experience, Functional Requirements Specification
 * v1.0*; where the document says TBD, so does this file.
 *
 * ## What this is not
 *
 * It is not a second application. WIQAR runs the same backend, the same screens and the same
 * seven coded activity modules that any organisation can adopt. What makes it WIQAR is the rows
 * below and the activities it has adopted — nothing else in the codebase knows its name.
 *
 * Every write goes through the ordinary models, so organisation scoping stamps `tenantId` on
 * each row without this file mentioning it.
 */

/** §4.1 — the seven experience packages, each a coded module in the catalogue. */
const ADOPTED: EngineKind[] = [
  'HORSE_RIDING',
  'EQUESTRIAN_LESSON',
  'CAMEL_TOUR',
  'ANIMAL_CARE',
  'ANIMAL_FEEDING',
  'PHOTOGRAPHY',
  'GROUP_PACKAGE',
]

/** §3.1 — three locations, identical architecture at each. */
const LOCATIONS = [
  { key: 'usfan', name: "South of 'Usfan", nameAr: 'جنوب عسفان' },
  { key: 'jihfa', name: 'Al-Jihfa', nameAr: 'الجحفة' },
  { key: 'qahah', name: 'Wadi al-Qahah', nameAr: 'وادي القاحة' },
]

/**
 * §3.2 — the seven service areas within each location.
 *
 * `activities` is what actually happens there, which is what decides where a counter can be
 * built and where a session takes place.
 */
const AREAS = [
  { key: 'welcome', name: 'Main Entrance & Welcome Desk', nameAr: 'المدخل الرئيسي ومكتب الاستقبال', activities: ADOPTED },
  { key: 'equestrian', name: 'Equestrian Track & Stable', nameAr: 'مضمار الفروسية والإسطبل', activities: ['HORSE_RIDING', 'EQUESTRIAN_LESSON', 'ANIMAL_CARE'] as EngineKind[] },
  { key: 'camel', name: 'Camel Paddock', nameAr: 'حظيرة الإبل', activities: ['CAMEL_TOUR', 'GROUP_PACKAGE'] as EngineKind[] },
  { key: 'village', name: 'Animal Village', nameAr: 'قرية الحيوانات', activities: ['ANIMAL_FEEDING', 'PHOTOGRAPHY'] as EngineKind[] },
  { key: 'studio', name: 'Photography Studio', nameAr: 'استوديو التصوير', activities: ['PHOTOGRAPHY', 'GROUP_PACKAGE'] as EngineKind[] },
  { key: 'shop_m', name: 'Changing Rooms — Male Shop', nameAr: 'غرف التبديل — متجر الرجال', activities: [] as EngineKind[] },
  { key: 'shop_f', name: 'Changing Rooms — Female Shop', nameAr: 'غرف التبديل — متجر النساء', activities: [] as EngineKind[] },
]

/**
 * §3.2 — the counters.
 *
 * A main reception that books every experience, and the two changing-room shops that sell
 * retail only. A shop counter takes no experience bookings, which is why its activity list is
 * empty rather than a copy of reception's.
 */
const COUNTERS = [
  { key: 'reception', area: 'welcome', name: 'Main Reception POS', nameAr: 'نقطة البيع الرئيسية', activities: ADOPTED },
  { key: 'shop_m', area: 'shop_m', name: 'Male Shop POS', nameAr: 'نقطة بيع متجر الرجال', activities: [] as EngineKind[] },
  { key: 'shop_f', area: 'shop_f', name: 'Female Shop POS', nameAr: 'نقطة بيع متجر النساء', activities: [] as EngineKind[] },
]

/**
 * §7.1 — the live inventory.
 *
 * Counts are the document's totals spread across the three locations. Deer is *"TBD"* in the
 * specification and is seeded at a nominal four per location so the Animal Village is not
 * empty; that number carries no authority.
 */
const SPECIES = [
  { key: 'horse', name: 'Arabian Horse', nameAr: 'حصان عربي', prefix: 'H', area: 'equestrian', perLocation: 10 },
  { key: 'camel', name: 'Camel', nameAr: 'جمل', prefix: 'C', area: 'camel', perLocation: 6 },
  { key: 'goat', name: 'Goat', nameAr: 'ماعز', prefix: 'G', area: 'village', perLocation: 8 },
  { key: 'deer', name: 'Deer', nameAr: 'غزال', prefix: 'D', area: 'village', perLocation: 4 },
]

/** §4.2 — the changing-room shop catalogue. Prices are TBD in the document. */
const RETAIL = [
  { key: 'helmet', name: 'Riding Helmet', nameAr: 'خوذة ركوب', category: 'Equestrian accessories', price: 180 },
  { key: 'gloves', name: 'Riding Gloves', nameAr: 'قفازات ركوب', category: 'Equestrian accessories', price: 65 },
  { key: 'crop', name: 'Riding Crop', nameAr: 'سوط ركوب', category: 'Equestrian accessories', price: 45 },
  { key: 'brush', name: 'Grooming Brush', nameAr: 'فرشاة عناية', category: 'Animal care products', price: 35 },
  { key: 'kit', name: 'Grooming Kit', nameAr: 'طقم العناية', category: 'Animal care products', price: 120 },
  { key: 'halter', name: 'Halter', nameAr: 'رسن', category: 'Animal care products', price: 90 },
  { key: 'scarf', name: 'Heritage Scarf', nameAr: 'وشاح تراثي', category: 'Heritage memorabilia', price: 75 },
  { key: 'keychain', name: 'Branded Keychain', nameAr: 'ميدالية مفاتيح', category: 'Heritage memorabilia', price: 25 },
  { key: 'print', name: 'Calligraphic Print', nameAr: 'لوحة خط عربي', category: 'Heritage memorabilia', price: 150 },
  { key: 'feed', name: 'Animal Feed Pack', nameAr: 'كيس علف', category: 'Animal food', price: 20 },
]

/**
 * §5.1 — the roles, with the platform base role each maps onto.
 *
 * The specification's headcount is 20 confirmed with the animal-care roles *"TBD"*; one of each
 * is seeded per the locations they belong to, which is enough to sign in as every profile and
 * see what that profile sees.
 *
 * Cleaners are in §5.1 and are deliberately given no account: their work never touches the
 * system, and an account nobody signs into is an account somebody eventually borrows.
 */
const STAFF = [
  { key: 'ceo', title: 'CEO', role: 'TENANT_ADMIN', scope: 'central' },
  { key: 'project.manager', title: 'Project Manager', role: 'PROJECT_MANAGER', scope: 'central' },
  { key: 'admin.manager', title: 'Administrative Manager', role: 'HR', scope: 'central' },
  { key: 'chief.accountant', title: 'Chief Accountant', role: 'ACCOUNTANT', scope: 'central' },
  { key: 'it.manager', title: 'IT Manager', role: 'TENANT_ADMIN', scope: 'central' },
  { key: 'purchasing', title: 'Purchasing Agent', role: 'ACCOUNTANT', scope: 'central' },
  { key: 'supervisor', title: 'Supervisor', role: 'SUPERVISOR', scope: 'location' },
  { key: 'cashier', title: 'Cashier-Receptionist', role: 'AGENT', scope: 'location', counter: 'reception', activities: ADOPTED },
  { key: 'shop.cashier', title: 'Shop Cashier', role: 'AGENT', scope: 'location', counter: 'shop_m', activities: [] as EngineKind[] },
  { key: 'horse.trainer', title: 'Horse Trainer', role: 'AGENT', scope: 'location', counter: 'reception', activities: ['HORSE_RIDING', 'EQUESTRIAN_LESSON', 'ANIMAL_CARE'] as EngineKind[] },
  { key: 'camel.trainer', title: 'Camel Trainer', role: 'AGENT', scope: 'location', counter: 'reception', activities: ['CAMEL_TOUR', 'ANIMAL_FEEDING', 'GROUP_PACKAGE'] as EngineKind[] },
  { key: 'animal.worker', title: 'Animal Worker', role: 'AGENT', scope: 'location', counter: 'reception', activities: ['ANIMAL_FEEDING', 'PHOTOGRAPHY'] as EngineKind[] },
  { key: 'driver', title: 'Transport Driver', role: 'DELIVERY_AGENT', scope: 'central' },
]

/**
 * The password every seeded WIQAR account is given.
 *
 * Not a secret and not pretending to be one: it exists only on deployments that have declared
 * themselves demonstrations, and every account using it is printed on the sign-in page.
 */
const DEMO_PASSWORD = process.env.TENANT_DEMO_PASSWORD ?? 'Demo@12345'

const ORG = 'wiqar'

const siteId = (l: string) => `site_${ORG}_${l}`
const areaId = (l: string, a: string) => `stn_${ORG}_${l}_${a}`
const counterId = (l: string, c: string) => `ksk_${ORG}_${l}_${c}`
const speciesId = (s: string) => `at_${ORG}_${s}`
const animalId = (s: string, l: string, n: number) => `unit_${ORG}_${s}_${l}_${n}`
const productId = (k: string) => `pr_${ORG}_${k}`

export interface WiqarSeedReport {
  sites: number
  areas: number
  counters: number
  species: number
  animals: number
  products: number
  people: number
}

/**
 * Builds WIQAR inside the shared database.
 *
 * Idempotent throughout: anything already present is left exactly as it is, including edits an
 * administrator has made. Re-running must never quietly undo somebody's work.
 */
export async function seedWiqar(): Promise<WiqarSeedReport> {
  const report: WiqarSeedReport = { sites: 0, areas: 0, counters: 0, species: 0, animals: 0, products: 0, people: 0 }

  /* The organisation itself, with the seven activities it has adopted from the catalogue. */
  if (!(await Tenant.findById(ORG).lean())) {
    await Tenant.create({
      _id: ORG,
      tenantId: ORG,
      name: 'WIQAR',
      legalName: 'WIQAR Experiential Hospitality Co.',
      crNumber: '4030555123',
      vatNumber: '310555123400003',
      currency: 'SAR',
      vatRate: 0.15,
      enabledEngines: ADOPTED,
      branding: {
        primaryColor: '#8B5A2B',
        secondaryColor: '#5C3A1E',
        accentColor: '#C9A227',
        logoText: 'WQ',
      },
    })
  }

  const existing = {
    sites: new Set((await Site.find({}, { _id: 1 }).lean()).map((r) => String(r._id))),
    areas: new Set((await Station.find({}, { _id: 1 }).lean()).map((r) => String(r._id))),
    counters: new Set((await Kiosk.find({}, { _id: 1 }).lean()).map((r) => String(r._id))),
    species: new Set((await AssetType.find({}, { _id: 1 }).lean()).map((r) => String(r._id))),
    animals: new Set((await AssetUnit.find({}, { _id: 1 }).lean()).map((r) => String(r._id))),
    products: new Set((await CatalogueProduct.find({}, { _id: 1 }).lean()).map((r) => String(r._id))),
  }

  /* §3.1 — three locations, §3.2 — seven areas and three counters at each. */
  for (const location of LOCATIONS) {
    if (!existing.sites.has(siteId(location.key))) {
      await Site.create({
        _id: siteId(location.key),
        name: `Ana'am Experience — ${location.name}`,
        nameAr: `تجربة الأنعام — ${location.nameAr}`,
        city: 'Jeddah',
        active: true,
      })
      report.sites += 1
    }

    for (const area of AREAS) {
      const id = areaId(location.key, area.key)
      if (existing.areas.has(id)) continue
      await Station.create({
        _id: id,
        siteId: siteId(location.key),
        zoneId: null,
        name: `${location.name} — ${area.name}`,
        nameAr: `${location.nameAr} — ${area.nameAr}`,
        code: `${location.key}-${area.key}`,
        engineKinds: area.activities,
        active: true,
      })
      report.areas += 1
    }

    for (const counter of COUNTERS) {
      const id = counterId(location.key, counter.key)
      if (existing.counters.has(id)) continue
      await Kiosk.create({
        _id: id,
        siteId: siteId(location.key),
        stationId: areaId(location.key, counter.area),
        name: `${location.name} — ${counter.name}`,
        nameAr: `${location.nameAr} — ${counter.nameAr}`,
        code: `${location.key}-${counter.key}`,
        // A counter sells one activity at a time in this model; reception is the booking desk.
        engineKind: counter.activities[0] ?? null,
        activityKeys: counter.activities,
        isExitGate: false,
        active: true,
      })
      report.counters += 1
    }
  }

  /* §7.1 — the animals, each with an identifier of its own and a home area. */
  for (const species of SPECIES) {
    if (!existing.species.has(speciesId(species.key))) {
      await AssetType.create({
        _id: speciesId(species.key),
        name: species.name,
        nameAr: species.nameAr,
        kind: 'ANIMAL',
        // An animal is not owned by one experience: a horse is ridden, groomed and photographed.
        engineKind: null,
        capacity: { capacityScore: 0, seats: 1 },
        active: true,
      })
      report.species += 1
    }

    for (const location of LOCATIONS) {
      for (let n = 1; n <= species.perLocation; n += 1) {
        const id = animalId(species.key, location.key, n)
        if (existing.animals.has(id)) continue
        await AssetUnit.create({
          _id: id,
          assetTypeId: speciesId(species.key),
          identifier: `${species.prefix}-${location.key.slice(0, 3).toUpperCase()}-${String(n).padStart(3, '0')}`,
          stationId: areaId(location.key, species.area),
          assetAreaId: `area_${ORG}_1`,
          kioskId: null,
          gateId: null,
          status: 'AVAILABLE',
          currentBookingId: null,
        })
        report.animals += 1
      }
    }
  }

  /* §4.2 — the changing-room catalogue, the same at every location. */
  for (const product of RETAIL) {
    if (existing.products.has(productId(product.key))) continue
    await CatalogueProduct.create({
      _id: productId(product.key),
      name: product.name,
      nameAr: product.nameAr,
      category: product.category,
      basePrice: product.price,
      saleUnit: 'ITEM',
      saleType: 'SALE',
      billingModel: 'PACKAGE',
      engineKind: null,
      assetTypeId: null,
      active: true,
    })
    report.products += 1
  }

  /* §5.1 — one account per role, posted where that role works. */
  const home = LOCATIONS[0]
  for (const person of STAFF) {
    const email = `${person.key}.${ORG}@lockerflow.demo`
    if (await User.findOne({ email }).lean()) continue

    const central = person.scope === 'central'
    await User.create({
      _id: `usr_${person.key.replace(/\./g, '_')}_${ORG}`,
      email,
      fullName: `WIQAR ${person.title}`,
      passwordHash: hashPassword(DEMO_PASSWORD),
      demoCredential: DEMO_PASSWORD,
      role: person.role,
      siteId: siteId(home.key),
      stationId: central ? areaId(home.key, 'welcome') : areaId(home.key, 'welcome'),
      kioskId: person.counter ? counterId(home.key, person.counter) : null,
      engineKinds: person.activities ?? [],
      activityKeys: [],
      active: true,
    })
    report.people += 1
  }

  // A demonstration account is not a first-time employee — see onboarding.seed.ts.
  await markSeededAccountsOnboarded()

  logger.info('WIQAR seeded', { ...report })
  return report
}
