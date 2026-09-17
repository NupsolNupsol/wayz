import { AssetUnit, Booking, Order, Payment, Trip } from '../models/index.js';
import type { EngineKind } from '../domain/types.js';
import { logger } from '../config/logger.js';

/**
 * A day's worth of trading behind WAYZ's development data.
 *
 * This exists because of a real diagnosis, not a wish for more rows.
 *
 * The development database everybody remembered had thirty-five bookings across all three
 * activities, in every status — cancelled trips, finished rentals, drafts waiting at a desk.
 * The seed only ever produced seven, all of them Shop & Drop. The difference was **test
 * traffic**: twenty-eight bookings that a Playwright run had left behind in the shared
 * database on one afternoon, which everybody then took for the seed.
 *
 * So nothing was lost when WAYZ moved onto its own database — but the development experience
 * genuinely was thinner, and it had been resting on an accident. This makes the depth
 * deliberate: written by the seed, the same every time, and reproducible on a fresh machine
 * instead of depending on somebody having run the tests first.
 *
 * Two rules keep it from breaking the suites that share this data:
 *
 *   1. **Almost nothing holds inventory.** Completed, cancelled and draft bookings occupy no
 *      unit, so the compartments and vehicles the tests count on are exactly as free as
 *      before. A test that ran out of scooters because the seed had quietly taken two is a
 *      mistake already made once here.
 *   2. **The one live rental stands at the West Wing**, away from the boulevard desks the
 *      journeys exercise, on a kind with dozens of spares.
 */

const HOUR = 3_600_000;
const MIN = 60_000;
const VAT_RATE = 0.15;
const ago = (ms: number) => new Date(Date.now() - ms);

/** VAT-inclusive split, the way every price in this product is quoted. */
function split(total: number) {
  const base = Number((total / (1 + VAT_RATE)).toFixed(2));
  return { base, vat: Number((total - base).toFixed(2)), total };
}

interface HistoryRow {
  id: string;
  ref: string;
  engineKind: EngineKind;
  status: 'COMPLETED' | 'CANCELLED' | 'DRAFT' | 'ACTIVE';
  kioskId: string;
  agentId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  productNameAr: string;
  assetTypeId: string;
  price: number;
  minutesAgo: number;
  durationMin: number;
  /** Only the live rental names one, and only from a desk with spares. */
  holdsUnit?: boolean;
  cancelledReason?: string;
}

/*
 * Chosen to look like a day of trading rather than a list: three activities, several desks,
 * the four customers who already exist, and a spread of times through the afternoon.
 */
const HISTORY: HistoryRow[] = [
  {
    id: 'bk-h-lg-1',
    ref: 'LG-100201',
    engineKind: 'LAGOON',
    status: 'COMPLETED',
    kioskId: 'ksk_wayz_mountain',
    agentId: 'usr_welcome_wayz',
    customerId: 'cust_wayz_1',
    customerName: 'Ahmed Saleh',
    customerPhone: '0599709998',
    productName: 'Abra Trip',
    productNameAr: 'رحلة عبرة',
    assetTypeId: 'at_wayz_boat_abra',
    price: 90,
    minutesAgo: 260,
    durationMin: 30,
  },
  {
    id: 'bk-h-lg-2',
    ref: 'LG-100202',
    engineKind: 'LAGOON',
    status: 'COMPLETED',
    kioskId: 'ksk_wayz_egypt',
    agentId: 'usr_agent_egypt_wayz',
    customerId: 'cust_wayz_2',
    customerName: 'Sara Kamal',
    customerPhone: '0561234567',
    productName: 'Gondola Trip',
    productNameAr: 'رحلة جندول',
    assetTypeId: 'at_wayz_boat_gondola',
    price: 120,
    minutesAgo: 195,
    durationMin: 25,
  },
  {
    id: 'bk-h-lg-3',
    ref: 'LG-100203',
    engineKind: 'LAGOON',
    status: 'CANCELLED',
    kioskId: 'ksk_wayz_france',
    agentId: 'usr_captain_wayz',
    customerId: 'cust_wayz_3',
    customerName: 'Nora Hassan',
    customerPhone: '0512223344',
    productName: 'Dragon Boat',
    productNameAr: 'قارب التنين',
    assetTypeId: 'at_wayz_boat_dragon',
    price: 150,
    minutesAgo: 150,
    durationMin: 40,
    cancelledReason: 'Wind over the safe limit for the dragon boat',
  },
  {
    id: 'bk-h-lg-4',
    ref: 'LG-100204',
    engineKind: 'LAGOON',
    status: 'DRAFT',
    kioskId: 'ksk_wayz_mountain',
    agentId: 'usr_welcome_wayz',
    customerId: 'cust_wayz_2',
    customerName: 'Sara Kamal',
    customerPhone: '0561234567',
    productName: 'Feluka (small)',
    productNameAr: 'فلوكة صغيرة',
    assetTypeId: 'at_wayz_boat_feluka_small',
    price: 110,
    minutesAgo: 12,
    durationMin: 30,
  },
  {
    id: 'bk-h-mb-1',
    ref: 'MB-100205',
    engineKind: 'MOBILITY',
    status: 'COMPLETED',
    kioskId: 'ksk_wayz_gate1',
    agentId: 'usr_agent_gate1_wayz',
    customerId: 'cust_wayz_1',
    customerName: 'Ahmed Saleh',
    customerPhone: '0599709998',
    productName: 'Single Scooter',
    productNameAr: 'سكوتر فردي',
    assetTypeId: 'at_wayz_veh_single_scooter',
    price: 60,
    minutesAgo: 300,
    durationMin: 60,
  },
  {
    id: 'bk-h-mb-2',
    ref: 'MB-100206',
    engineKind: 'MOBILITY',
    status: 'COMPLETED',
    kioskId: 'ksk_wayz_gate2',
    agentId: 'usr_agent_gate2_wayz',
    customerId: 'cust_wayz_3',
    customerName: 'Nora Hassan',
    customerPhone: '0512223344',
    productName: "Children's Stroller (Standard)",
    productNameAr: 'عربة أطفال (عادية)',
    assetTypeId: 'at_wayz_veh_stroller_std',
    price: 35,
    minutesAgo: 220,
    durationMin: 120,
  },
  {
    id: 'bk-h-mb-3',
    ref: 'MB-100207',
    engineKind: 'MOBILITY',
    status: 'DRAFT',
    kioskId: 'ksk_wayz_gate1',
    agentId: 'usr_agent_gate1_wayz',
    customerId: 'cust_wayz_2',
    customerName: 'Sara Kamal',
    customerPhone: '0561234567',
    productName: 'Wheelchair',
    productNameAr: 'كرسي متحرك',
    assetTypeId: 'at_wayz_veh_wheelchair',
    price: 40,
    minutesAgo: 6,
    durationMin: 60,
  },
  {
    /*
     * The one live rental, deliberately at the West Wing.
     *
     * A running rental is the most useful thing to open in development, but taking a unit from
     * a boulevard bay is how the seed once starved Gate 1's six scooters and produced twenty
     * phantom test failures. This desk holds dozens of spares and no journey test touches it.
     */
    id: 'bk-h-mb-4',
    ref: 'MB-100208',
    engineKind: 'MOBILITY',
    status: 'ACTIVE',
    kioskId: 'ksk_wayz_ww_mob',
    agentId: 'usr_agent_all_wayz',
    customerId: 'cust_wayz_1',
    customerName: 'Ahmed Saleh',
    customerPhone: '0599709998',
    productName: 'Golf Cart',
    productNameAr: 'عربة جولف',
    assetTypeId: 'at_wayz_veh_cart',
    price: 180,
    minutesAgo: 35,
    durationMin: 120,
    holdsUnit: true,
  },
  {
    id: 'bk-h-sd-1',
    ref: 'SD-100209',
    engineKind: 'SHOP_AND_DROP',
    status: 'CANCELLED',
    kioskId: 'ksk_wayz_morocco',
    agentId: 'usr_agent_morocco_wayz',
    customerId: 'cust_wayz_3',
    customerName: 'Nora Hassan',
    customerPhone: '0512223344',
    productName: 'Shop & Drop — S (1 bag)',
    productNameAr: 'تسوق وأودع — صغير',
    assetTypeId: 'at_wayz_cmp_s',
    price: 30,
    minutesAgo: 175,
    durationMin: 120,
    cancelledReason: 'Customer changed their mind before handing the bag over',
  },
];

/** A free unit at a desk, for the single booking that actually holds one. */
async function freeUnitFor(kioskId: string, assetTypeId: string) {
  return AssetUnit.findOne({ tenantId: 'wayz', kioskId, assetTypeId, status: 'AVAILABLE' })
    .sort({ identifier: 1 })
    .lean();
}

export async function seedTradingHistory(): Promise<number> {
  let written = 0;

  for (const row of HISTORY) {
    const money = split(row.price);
    const started = ago(row.minutesAgo * MIN);
    const ended = new Date(started.getTime() + row.durationMin * MIN);
    const finished = row.status === 'COMPLETED';
    const paid = finished || row.status === 'ACTIVE';

    const unit = row.holdsUnit ? await freeUnitFor(row.kioskId, row.assetTypeId) : null;
    if (row.holdsUnit && !unit) {
      // Better to leave the row out than to write a rental pointing at nothing.
      logger.warn('Trading history: no free unit, skipping', { ref: row.ref, kiosk: row.kioskId });
      continue;
    }

    await Order.create({
      _id: `ord-${row.id}`,
      ref: row.ref.replace(/^[A-Z]{2}-/, ''),
      tenantId: 'wayz',
      stationId: 'stn_wayz_1',
      kioskId: row.kioskId,
      agentId: row.agentId,
      customerId: row.customerId,
      engineKind: row.engineKind,
      lines: [
        {
          productId: `pr_hist_${row.id}`,
          name: row.productName,
          quantity: 1,
          unitPrice: row.price,
          isDeposit: false,
          taxable: true,
        },
      ],
      status: paid ? 'PAID' : row.status === 'CANCELLED' ? 'CANCELLED' : 'DRAFT',
      subtotal: money.base,
      vat: money.vat,
      depositTotal: 0,
      total: row.price,
      hold: null,
      createdAt: started,
    });

    if (paid) {
      await Payment.create({
        _id: `pay-${row.id}`,
        tenantId: 'wayz',
        stationId: 'stn_wayz_1',
        kioskId: row.kioskId,
        orderId: `ord-${row.id}`,
        bookingId: row.id,
        amount: money.total,
        baseAmount: money.base,
        vatAmount: money.vat,
        vatRate: VAT_RATE,
        engineKind: row.engineKind,
        method: row.minutesAgo % 2 === 0 ? 'CARD' : 'CASH',
        cardScheme: row.minutesAgo % 2 === 0 ? 'MADA' : undefined,
        kind: 'SALE',
        status: 'CAPTURED',
        takenBy: row.agentId,
        shiftId: 'shift_wayz_open',
        createdAt: started,
      });
    }

    const sessionKind =
      row.engineKind === 'SHOP_AND_DROP'
        ? 'STORAGE'
        : row.engineKind === 'LAGOON'
          ? 'ACTIVITY'
          : 'RENTAL';

    await Booking.create({
      _id: row.id,
      ref: row.ref,
      tenantId: 'wayz',
      stationId: 'stn_wayz_1',
      kioskId: row.kioskId,
      agentId: row.agentId,
      orderId: `ord-${row.id}`,
      customerId: row.customerId,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      engineKind: row.engineKind,
      productName: row.productName,
      productNameAr: row.productNameAr,
      baseAmount: money.base,
      vatAmount: money.vat,
      totalAmount: row.price,
      vatRate: VAT_RATE,
      status: row.status,
      bags: [],
      session: {
        kind: sessionKind,
        status: row.status,
        assetUnitId: unit ? String(unit._id) : null,
        requestedDurationMin: row.engineKind === 'LAGOON' ? 0 : row.durationMin,
        startedAt: row.status === 'DRAFT' ? null : started,
        expectedEndAt: row.status === 'DRAFT' ? null : ended,
        chargeableEndedAt: finished ? ended : null,
        gracePeriodMin: 15,
        overtimeHourlyRate: row.engineKind === 'MOBILITY' ? 35 : 0,
        expiryWarningSentAt: null,
        paidAt: paid ? started : null,
      },
      reservation: null,
      assetUnitId: unit ? String(unit._id) : null,
      packingPlan: null,
      custody: finished
        ? [
            { from: 'AGENT', to: 'CUSTOMER', at: started, note: 'Handed over' },
            { from: 'CUSTOMER', to: 'AGENT', at: ended, note: 'Returned' },
          ]
        : row.status === 'ACTIVE'
          ? [{ from: 'AGENT', to: 'CUSTOMER', at: started, note: 'Handed over' }]
          : [],
      cancelledReason: row.cancelledReason ?? null,
      metadata: { assetTypeId: row.assetTypeId, kioskId: row.kioskId, visitors: 1 },
      createdAt: started,
      updatedAt: row.status === 'DRAFT' ? started : ended,
    });

    if (unit) {
      await AssetUnit.updateOne(
        { _id: unit._id },
        { $set: { status: 'RENTED', currentBookingId: row.id } }
      );
    }

    written += 1;
  }

  /*
   * One finished voyage, so the lagoon's trip history is not empty on a fresh machine.
   *
   * The old development database had exactly one, left behind by a test run. Writing it here
   * makes it a property of the seed rather than of whoever last ran the suite.
   */
  await Trip.create({
    _id: 'trp-hist-1',
    ref: 'TRP-100201',
    tenantId: 'wayz',
    stationId: 'stn_wayz_1',
    kioskId: 'ksk_wayz_mountain',
    assetTypeId: 'at_wayz_boat_abra',
    assetTypeName: 'Abra',
    seats: 6,
    assetUnitId: 'unit_wayz_ABR1',
    assetUnitIdentifier: 'ABR-01',
    /* Who was aboard, not how many: a trip carries its manifest, and the two lagoon trips
     * that finished this afternoon are the two that fill it. */
    passengers: [
      { bookingId: 'bk-h-lg-1', bookingRef: 'LG-100201', customerName: 'Ahmed Saleh', people: 2 },
      { bookingId: 'bk-h-lg-2', bookingRef: 'LG-100202', customerName: 'Sara Kamal', people: 2 },
    ],
    headcount: 4,
    status: 'COMPLETED',
    captainId: 'usr_captain_wayz',
    captainName: 'Captain Yusuf',
    createdBy: 'usr_welcome_wayz',
    startedAt: ago(260 * MIN),
    endedAt: ago(230 * MIN),
    stops: [],
    route: [],
    createdAt: ago(265 * MIN),
  });

  logger.info('Trading history seeded', { bookings: written, trips: 1 });
  return written;
}

export const TRADING_HISTORY_HOURS = Math.round((300 * MIN) / HOUR);
