import {
  Audit,
  AssetType,
  AssetUnit,
  Booking,
  CatalogueProduct,
  Customer,
  Order,
  Payment,
  Receipt,
  Shift,
  Site,
  Station,
  Kiosk,
  Counter,
  CashMovement,
  CardTransaction,
  CommissionRate,
  Expense,
  InvoiceDoc,
  ManualSale,
  Notification,
  RefundRequest,
  Trip,
  Season,
  DeliveryRequest,
  Tenant,
  User,
  Zone,
  hashPassword,
} from "../models/index.js";
import { Version } from "../models/index.js";
import { seedVersions } from "./versions.seed.js";
import type { UserDoc } from "../models/index.js";
import type { EngineKind } from "../domain/types.js";
import { DEFAULT_COMMISSION_RATES, type CardScheme } from "../domain/commission.js";
import { SCHEME_LABELS } from "../constants/labels.constants.js";
import { logger } from "../config/logger.js";
import { DEFAULT_PENALTY_SCHEDULE, DEFAULT_RENTAL_RULES } from "../domain/rules.js";

const SEEDED_TENANTS = (process.env.SEED_TENANTS ?? "wayz")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

const seeded = (tenantId: string) => SEEDED_TENANTS.includes(tenantId);

const DEMO_ENGINES: EngineKind[] = ["SHOP_AND_DROP", "MOBILITY", "LAGOON"];

const TENANT_ENGINES: Record<string, EngineKind[]> = {
  wayz: DEMO_ENGINES,
};

function tenantRuns(tenantId: string, engineKind: EngineKind): boolean {
  const engines = TENANT_ENGINES[tenantId];
  return !engines || engines.includes(engineKind);
}

function onlyRunEngines<T extends object>(rows: T[]): T[] {
  return rows.filter((r) => {
    const { tenantId, engineKind } = r as { tenantId?: string; engineKind?: EngineKind };
    return !tenantId || !engineKind || tenantRuns(tenantId, engineKind);
  });
}

function tenantRows<T extends { _id: string }>(rows: T[]): T[] {
  return rows.filter((t) => seeded(t._id));
}

function onlySeeded<T extends object>(rows: T[]): T[] {
  return rows.filter((r) => {
    const tenantId = (r as { tenantId?: string }).tenantId;
    return tenantId === undefined || seeded(tenantId);
  });
}

const HOUR = 3_600_000;
const MIN = 60_000;
const ALL_ENGINES: EngineKind[] = [
  "SHOP_AND_DROP",
  "MOBILITY",
  "LAGOON",
  "COTE_RESTAURANT",
  "ANAAM",
];

function assetTypes(t: string) {
  const compartment = (
    key: string,
    name: string,
    score: number,
    maxBags: number,
    dims: { w: number; h: number; d: number },
  ) => ({
    _id: `at_${t}_cmp_${key}`,
    tenantId: t,
    engineKind: "SHOP_AND_DROP",
    name: `Bag Size ${name}`,
    kind: "COMPARTMENT",
    capacity: {
      internalDimensions: dims,
      maxWeight: score,
      maxRecommendedBagCount: maxBags,
      compatibleBagCategories: ["SOFT", "HARD", "FRAGILE"],
      capacityScore: score,
    },
  });

  const vehicle = (key: string, name: string, seats: number, engineKind: EngineKind = "MOBILITY") => ({
    _id: `at_${t}_veh_${key}`,
    tenantId: t,
    engineKind,
    name,
    kind: "VEHICLE",
    capacity: { capacityScore: 0, seats },
  });

  const boat = (key: string, name: string, seats: number) => ({
    _id: `at_${t}_boat_${key}`,
    tenantId: t,
    engineKind: "LAGOON",
    name,
    kind: "BOAT",
    capacity: { capacityScore: 0, seats },
  });

  return [
    compartment("s", "S", 40, 2, { w: 30, h: 30, d: 40 }),
    compartment("m", "M", 80, 3, { w: 40, h: 45, d: 55 }),
    compartment("l", "L", 140, 5, { w: 55, h: 60, d: 70 }),
    compartment("xl", "XL", 220, 8, { w: 70, h: 80, d: 90 }),
    compartment("xxl", "XXL", 300, 12, { w: 85, h: 95, d: 110 }),

    vehicle("single_scooter", "Single Electric Scooter", 1),
    vehicle("double_scooter", "Double Electric Scooter", 2),
    vehicle("wheelchair", "Wheelchair", 1),
    vehicle("stroller_std", "Children's Stroller (Standard)", 1),
    vehicle("stroller_vip", "Children's Stroller (VIP)", 1),
    vehicle("tuktuk", "Electric Tuk-Tuk", 4),
    vehicle("cart", "Shopping Cart", 0),
    vehicle("trolley", "Shop Trolley", 0, "SHOP_AND_DROP"),

    boat("abra", "Abra", 8),
    boat("gondola", "Gondola", 6),
    boat("feluka_small", "Feluka (Small)", 10),
    boat("feluka_large", "Feluka (Large)", 20),
    boat("donut", "Donut Boat", 6),
    boat("submarine", "Submarine", 12),
    boat("dragon", "Dragon Boat", 20),
    boat("amphicar", "Amphicar", 4),
    boat("rescue", "Rescue Boat", 4),

    {
      _id: `at_${t}_table`,
      tenantId: t,
      engineKind: "COTE_RESTAURANT",
      name: "Restaurant Table",
      kind: "TABLE",
      capacity: { capacityScore: 0, seats: 4 },
    },
    {
      _id: `at_${t}_animal`,
      tenantId: t,
      engineKind: "ANAAM",
      name: "Experience Animal",
      kind: "ANIMAL",
      capacity: { capacityScore: 0, seats: 1 },
    },
  ];
}

function products(t: string) {
  const p = (o: Record<string, unknown>) => ({
    tenantId: t,
    category: "General",
    depositRequired: 0,
    penaltyPrice: 0,
    saleUnit: "ITEM",
    saleType: "RENTAL",
    assetTypeId: null,
    billingModel: "PER_BAG",
    emoji: "📦",
    active: true,
    ...o,
  });

  const bag = (key: string, size: string, price: number, overtime: number) =>
    p({
      _id: `pr_${t}_sd_${key}`,
      name: `Bag Size ${size}`,
      engineKind: "SHOP_AND_DROP",
      category: "Shop & Drop",
      basePrice: price,
      overtimeHourlyRate: overtime,
      saleUnit: "BAG",
      saleType: "SALE",
      billingModel: key === "s" || key === "m" ? "PER_BAG" : "PER_COMPARTMENT",
      assetTypeId: `at_${t}_cmp_${key}`,
      emoji: "🛍️",
    });

  const boatTrip = (key: string, name: string, price: number, emoji: string) =>
    p({
      _id: `pr_${t}_lag_${key}`,
      name,
      engineKind: "LAGOON",
      category: "Lagoon",
      basePrice: price,
      saleUnit: "TOUR",
      saleType: "RENTAL",
      billingModel: "PACKAGE",
      assetTypeId: `at_${t}_boat_${key}`,
      emoji,
    });

  return [
    bag("s", "S", 30, 20),
    bag("m", "M", 40, 25),
    bag("l", "L", 60, 30),
    bag("xl", "XL", 70, 35),
    bag("xxl", "XXL", 90, 45),
    p({
      _id: `pr_${t}_sd_delivery`,
      name: "Delivery to Car",
      engineKind: "SHOP_AND_DROP",
      category: "Shop & Drop",
      basePrice: 40,
      saleUnit: "DELIVERY",
      saleType: "SALE",
      billingModel: "PACKAGE",
      emoji: "🚚",
    }),
    p({
      _id: `pr_${t}_sd_trolley`,
      name: "Shop Trolley",
      engineKind: "SHOP_AND_DROP",
      category: "Shop & Drop",
      basePrice: 20,
      overtimeHourlyRate: 20,
      saleUnit: "HOUR",
      saleType: "RENTAL",
      billingModel: "DURATION_BASED",
      durationUnit: "HOUR",
      assetTypeId: `at_${t}_veh_trolley`,
      emoji: "🛒",
    }),

    p({
      _id: `pr_${t}_mob_single_hour`,
      name: "Single Electric Scooter",
      engineKind: "MOBILITY",
      category: "Mobility",
      basePrice: 50,
      hourlyPrice: 50,
      tourPrice: 80,
      tourMinutes: 45,
      overtimeHourlyRate: 50,
      penaltyPrice: 500,
      saleUnit: "HOUR",
      saleType: "RENTAL",
      billingModel: "DURATION_BASED",
      durationUnit: "HOUR",
      assetTypeId: `at_${t}_veh_single_scooter`,
      emoji: "🛴",
      proposedPolicy: {
        minAge: 16,
        conditionInspection: "MANDATORY_PHOTO",
        safetyAck: true,
        overtimeRule: "A full hour once the grace period is gone",
        returnLocation: "The station it left from",
        damageRule: "Damage charged at the schedule rate",
      },
    }),
    p({
      _id: `pr_${t}_mob_single_day`,
      name: "Single Electric Scooter — Full Day",
      engineKind: "MOBILITY",
      category: "Mobility",
      basePrice: 385,
      overtimeHourlyRate: 50,
      penaltyPrice: 500,
      saleUnit: "FULL_DAY",
      saleType: "RENTAL",
      billingModel: "DURATION_BASED",
      durationUnit: "DAY",
      assetTypeId: `at_${t}_veh_single_scooter`,
      emoji: "🛴",
    }),
    p({
      _id: `pr_${t}_mob_double_hour`,
      name: "Double Electric Scooter — 1 Hour",
      engineKind: "MOBILITY",
      category: "Mobility",
      basePrice: 70,
      overtimeHourlyRate: 70,
      penaltyPrice: 500,
      saleUnit: "HOUR",
      saleType: "RENTAL",
      billingModel: "DURATION_BASED",
      durationUnit: "HOUR",
      assetTypeId: `at_${t}_veh_double_scooter`,
      emoji: "🛵",
      proposedPolicy: { minAge: 18, conditionInspection: "MANDATORY_PHOTO", safetyAck: true },
    }),
    p({
      _id: `pr_${t}_mob_double_day`,
      name: "Double Electric Scooter — Full Day",
      engineKind: "MOBILITY",
      category: "Mobility",
      basePrice: 500,
      overtimeHourlyRate: 70,
      penaltyPrice: 500,
      saleUnit: "FULL_DAY",
      saleType: "RENTAL",
      billingModel: "DURATION_BASED",
      durationUnit: "DAY",
      assetTypeId: `at_${t}_veh_double_scooter`,
      emoji: "🛵",
    }),
    p({
      _id: `pr_${t}_mob_tuk`,
      name: "Electric Tuk-Tuk",
      engineKind: "MOBILITY",
      category: "Mobility",
      basePrice: 150,
      saleUnit: "TOUR",
      saleType: "RENTAL",
      billingModel: "PACKAGE",
      assetTypeId: `at_${t}_veh_tuktuk`,
      emoji: "🛺",
      proposedPolicy: { minAge: 18, licenseRequired: true, conditionInspection: "MANDATORY", safetyAck: true },
    }),
    p({
      _id: `pr_${t}_mob_stroller_std`,
      name: "Children's Stroller (Standard)",
      engineKind: "MOBILITY",
      category: "Mobility",
      basePrice: 35,
      overtimeHourlyRate: 35,
      depositRequired: 100,
      penaltyPrice: 150,
      saleUnit: "HOUR",
      saleType: "RENTAL",
      billingModel: "DURATION_BASED",
      durationUnit: "HOUR",
      assetTypeId: `at_${t}_veh_stroller_std`,
      emoji: "🍼",
      proposedPolicy: { conditionInspection: "VISUAL" },
    }),
    p({
      _id: `pr_${t}_mob_stroller_vip`,
      name: "Children's Stroller (VIP)",
      engineKind: "MOBILITY",
      category: "Mobility",
      basePrice: 50,
      overtimeHourlyRate: 50,
      depositRequired: 100,
      penaltyPrice: 150,
      saleUnit: "HOUR",
      saleType: "RENTAL",
      billingModel: "DURATION_BASED",
      durationUnit: "HOUR",
      assetTypeId: `at_${t}_veh_stroller_vip`,
      emoji: "👶",
      proposedPolicy: { conditionInspection: "VISUAL" },
    }),
    p({
      _id: `pr_${t}_mob_wheel_hour`,
      name: "Wheelchair — 1 Hour",
      engineKind: "MOBILITY",
      category: "Mobility",
      basePrice: 35,
      overtimeHourlyRate: 35,
      depositRequired: 100,
      penaltyPrice: 200,
      saleUnit: "HOUR",
      saleType: "RENTAL",
      billingModel: "DURATION_BASED",
      durationUnit: "HOUR",
      assetTypeId: `at_${t}_veh_wheelchair`,
      emoji: "♿",
      proposedPolicy: { conditionInspection: "VISUAL" },
    }),
    p({
      _id: `pr_${t}_mob_wheel_day`,
      name: "Wheelchair — Full Day",
      engineKind: "MOBILITY",
      category: "Mobility",
      basePrice: 250,
      overtimeHourlyRate: 35,
      penaltyPrice: 200,
      saleUnit: "FULL_DAY",
      saleType: "RENTAL",
      billingModel: "DURATION_BASED",
      durationUnit: "DAY",
      assetTypeId: `at_${t}_veh_wheelchair`,
      emoji: "♿",
    }),
    p({
      _id: `pr_${t}_mob_cart`,
      name: "Shopping Cart",
      engineKind: "MOBILITY",
      category: "Mobility",
      basePrice: 75,
      saleUnit: "CART",
      saleType: "SALE",
      billingModel: "PACKAGE",
      assetTypeId: `at_${t}_veh_cart`,
      emoji: "🛒",
      proposedPolicy: { conditionInspection: "SKIP" },
    }),

    boatTrip("abra", "Abra Trip", 90, "🛶"),
    boatTrip("gondola", "Gondola Trip", 120, "🚣"),
    boatTrip("feluka_small", "Feluka (Small) Trip", 150, "⛵"),
    boatTrip("feluka_large", "Feluka (Large) Trip", 250, "⛵"),
    boatTrip("donut", "Donut Boat Trip", 80, "🍩"),
    boatTrip("submarine", "Submarine Trip", 300, "🚤"),
    boatTrip("dragon", "Dragon Boat Trip", 200, "🐉"),
    boatTrip("amphicar", "Amphicar Trip", 180, "🚗"),

    p({
      _id: `pr_${t}_cote_burger`,
      name: "COTE Signature Burger",
      engineKind: "COTE_RESTAURANT",
      basePrice: 55,
      category: "Mains",
      saleUnit: "ITEM",
      saleType: "SALE",
      billingModel: "PACKAGE",
      emoji: "🍔",
    }),
    p({
      _id: `pr_${t}_cote_salad`,
      name: "Lagoon Salad",
      engineKind: "COTE_RESTAURANT",
      basePrice: 35,
      category: "Starters",
      saleUnit: "ITEM",
      saleType: "SALE",
      billingModel: "PACKAGE",
      emoji: "🥗",
    }),
    p({
      _id: `pr_${t}_anaam_pony`,
      name: "Pony Ride Experience",
      engineKind: "ANAAM",
      basePrice: 80,
      category: "Ana'am",
      saleUnit: "TOUR",
      saleType: "RENTAL",
      billingModel: "PACKAGE",
      assetTypeId: `at_${t}_animal`,
      emoji: "🐴",
    }),
  ];
}

function assetUnits(t: string, stationId: string) {
  const area = `area_${t}_1`;
  const units: Record<string, unknown>[] = [];
  const push = (
    typeKey: string,
    id: string,
    identifier: string,
    penaltyPrice: number | null = null,
  ) =>
    units.push({
      _id: id,
      tenantId: t,
      stationId,
      assetAreaId: area,
      assetTypeId: `at_${t}_${typeKey}`,
      identifier,
      status: "AVAILABLE",
      currentBookingId: null,
      penaltyPrice,
    });

  const sizes: [string, string, number][] = [
    ["cmp_s", "S", 30],
    ["cmp_m", "M", 30],
    ["cmp_l", "L", 24],
    ["cmp_xl", "X", 12],
    ["cmp_xxl", "Z", 9],
  ];
  let n = 1;
  for (const [key, letter, count] of sizes) {
    for (let i = 1; i <= count; i++) {
      push(key, `unit_${t}_${letter}${i}`, `${letter}-${String(n).padStart(2, "0")}`);
      n++;
    }
  }

  const veh: [string, string, number, number | null][] = [
    ["veh_single_scooter", "SC", 18, 500],
    ["veh_double_scooter", "DS", 9, 500],
    ["veh_wheelchair", "WC", 9, 200],
    ["veh_stroller_std", "ST", 9, 150],
    ["veh_stroller_vip", "SV", 6, 150],
    ["veh_tuktuk", "TT", 6, 2500],
    ["veh_cart", "CT", 9, null],
    ["veh_trolley", "TR", 9, null],
  ];
  for (const [key, pre, count, penalty] of veh) {
    for (let i = 1; i <= count; i++) {
      push(key, `unit_${t}_${pre}${i}`, `${pre}-${String(i).padStart(2, "0")}`, penalty);
    }
  }

  const boats: [string, string, number][] = [
    ["boat_abra", "ABR", 4],
    ["boat_gondola", "GON", 3],
    ["boat_feluka_small", "FKS", 1],
    ["boat_feluka_large", "FKL", 1],
    ["boat_donut", "DNT", 3],
    ["boat_submarine", "SUB", 1],
    ["boat_dragon", "DRG", 1],
    ["boat_amphicar", "AMP", 3],
    ["boat_rescue", "RSQ", 2],
  ];
  for (const [key, pre, count] of boats) {
    for (let i = 1; i <= count; i++) {
      push(key, `unit_${t}_${pre}${i}`, `${pre}-${String(i).padStart(2, "0")}`);
    }
  }

  for (let i = 1; i <= 8; i++) push("table", `unit_${t}_T${i}`, `T${i}`);
  for (let i = 1; i <= 4; i++) push("animal", `unit_${t}_A${i}`, `ANM-${i}`);
  return units;
}

const SHOP_AND_DROP_DESKS: [string, string, string][] = [
  ["iran", "Iran", "Iran pavilion, ground floor"],
  ["morocco", "Morocco", "Morocco pavilion, by the souk arch"],
  ["levant", "Levant", "Levant pavilion, east entrance"],
];

const MOBILITY_DESKS: [string, string, string][] = [
  ["gate1", "Gate 1", "Main gate, vehicle bay"],
  ["gate2", "Gate 2", "South gate, vehicle bay"],
  ["vip", "VIP Gate", "VIP entrance, covered bay"],
];

const LAGOON_DESKS: [string, string, string][] = [
  ["mountain", "Mountain", "Mountain jetty"],
  ["france", "France", "France jetty"],
  ["egypt", "Egypt", "Egypt jetty"],
];

const BOULEVARD_MAP: Record<string, [number, number]> = {
  iran: [0.18, 0.28],
  morocco: [0.34, 0.16],
  levant: [0.52, 0.24],
  gate1: [0.12, 0.62],
  gate2: [0.3, 0.78],
  vip: [0.09, 0.44],
  mountain: [0.72, 0.2],
  france: [0.84, 0.44],
  egypt: [0.66, 0.68],
};

const boulevardKiosk = (
  engineKind: EngineKind,
  prefix: string,
  [key, name, location]: [string, string, string],
) => ({
  _id: `ksk_wayz_${key}`,
  tenantId: "wayz",
  siteId: "site_wayz_1",
  stationId: "stn_wayz_1",
  name,
  code: `BLV-${prefix}-${key.toUpperCase()}`,
  location,
  engineKind,
  active: true,
  mapX: BOULEVARD_MAP[key]?.[0] ?? null,
  mapY: BOULEVARD_MAP[key]?.[1] ?? null,
});

async function freeUnitAt(kioskId: string, assetTypeId: string) {
  const unit = await AssetUnit.findOne({
    tenantId: "wayz",
    kioskId,
    assetTypeId,
    status: "AVAILABLE",
  })
    .sort({ identifier: 1 })
    .lean();
  if (!unit) throw new Error(`Seed: ${kioskId} has no free ${assetTypeId} to hand out.`);
  return { _id: String(unit._id), identifier: String(unit.identifier), kioskId };
}

async function seedStoredElsewhere(input: {
  orderId: string;
  bookingId: string;
  ref: string;
  kioskId: string;
  agentId: string;
  assetTypeId: string;
  productId: string;
  productName: string;
  price: number;
  bags: string[];
  barcodePrefix: string;
}) {
  const tax = splitInclusive(input.price);
  const unit = await freeUnitAt(input.kioskId, input.assetTypeId);

  await Order.create({
    _id: input.orderId,
    ref: input.ref.replace("SD-", ""),
    tenantId: "wayz",
    stationId: "stn_wayz_1",
    agentId: input.agentId,
    customerId: "cust_wayz_1",
    engineKind: "SHOP_AND_DROP",
    lines: [
      {
        productId: input.productId,
        name: input.productName,
        quantity: 1,
        unitPrice: input.price,
        isDeposit: false,
        taxable: true,
      },
    ],
    status: "PAID",
    subtotal: tax.base,
    vat: tax.vat,
    depositTotal: 0,
    total: input.price,
    hold: null,
  });

  await Payment.create({
    _id: `pay-${input.bookingId}`,
    tenantId: "wayz",
    stationId: "stn_wayz_1",
    kioskId: input.kioskId,
    orderId: input.orderId,
    bookingId: input.bookingId,
    amount: tax.total,
    baseAmount: tax.base,
    vatAmount: tax.vat,
    vatRate: VAT_RATE,
    engineKind: "SHOP_AND_DROP",
    method: "CARD",
    cardScheme: "MADA",
    kind: "SALE",
    status: "CAPTURED",
    takenBy: input.agentId,
    shiftId: "shift_wayz_open",
  });

  await Booking.create({
    _id: input.bookingId,
    ref: input.ref,
    tenantId: "wayz",
    stationId: "stn_wayz_1",
    kioskId: input.kioskId,
    agentId: input.agentId,
    orderId: input.orderId,
    customerId: "cust_wayz_1",
    customerName: "Ahmed Saleh",
    customerPhone: "0599709998",
    engineKind: "SHOP_AND_DROP",
    productName: input.productName,
    status: "ACTIVE",
    bags: input.bags.map((description, i) => ({
      index: i + 1,
      category: "SOFT",
      description,
      dimensions: { w: 30, h: 25, d: 20 },
      weight: 3,
      barcode: `${input.barcodePrefix}${String(100000 + i)}`,
      status: "STORED",
      assignedUnitId: unit._id,
    })),
    session: {
      kind: "STORAGE",
      status: "ACTIVE",
      assetUnitId: unit._id,
      requestedDurationMin: 180,
      startedAt: new Date(Date.now() - 40 * MIN),
      expectedEndAt: new Date(Date.now() + 140 * MIN),
      gracePeriodMin: 15,
      overtimeHourlyRate: 30,
      paidAt: new Date(Date.now() - 45 * MIN),
      expiryWarningSentAt: null,
    },
    reservation: { assetUnitId: unit._id, expiresAt: new Date(Date.now() + HOUR), status: "CONSUMED" },
    assetUnitId: unit._id,
    packingPlan: {
      requiredCapacityScore: 30 * input.bags.length,
      suggestedAssetTypeId: input.assetTypeId,
      numberOfCompartmentsRequired: 1,
      allocations: [{ compartmentIndex: 0, bagIndexes: input.bags.map((_, i) => i + 1) }],
      priceCalculationSummary: `1 compartment(s) × ${input.price} (PER_COMPARTMENT)`,
    },
    custody: [
      { from: "CUSTOMER", to: "AGENT", at: new Date(Date.now() - 45 * MIN), note: "Bags received at desk" },
      { from: "AGENT", to: "LOCKER", at: new Date(Date.now() - 40 * MIN), note: "Stored — timer started" },
    ],
    metadata: { assetTypeId: input.assetTypeId, kioskId: input.kioskId },
  });

  await AssetUnit.updateOne(
    { _id: unit._id },
    { $set: { status: "OCCUPIED", currentBookingId: input.bookingId } },
  );
}

function boulevardDeskFor(assetTypeId: string, index: number): string | null {
  const desks = assetTypeId.includes("cmp")
    ? SHOP_AND_DROP_DESKS
    : assetTypeId.includes("veh_trolley")
      ? SHOP_AND_DROP_DESKS
      : assetTypeId.includes("veh")
        ? MOBILITY_DESKS
        : assetTypeId.includes("boat")
          ? LAGOON_DESKS
          : null;
  if (!desks) return null;
  return `ksk_wayz_${desks[index % desks.length][0]}`;
}

const shopAndDropKiosks = () => SHOP_AND_DROP_DESKS.map((d) => boulevardKiosk("SHOP_AND_DROP", "SD", d));
const mobilityKiosks = () => MOBILITY_DESKS.map((d) => boulevardKiosk("MOBILITY", "MB", d));
const lagoonKiosks = () => LAGOON_DESKS.map((d) => boulevardKiosk("LAGOON", "LG", d));

type DemoUser = Omit<UserDoc, "comparePassword" | "invite" | "engineKinds"> & {
  engineKinds?: EngineKind[];
};

function demoUsers(): DemoUser[] {
  const base = {
    tenantId: "wayz",
    siteId: "site_wayz_1",
    zoneId: "zone_wayz_1",
    stationId: "stn_wayz_1",
    kioskId: null,
    reportsTo: null,
    active: true,
  } as const;

  const wiqar = {
    tenantId: "wiqar",
    siteId: "site_wiqar_1",
    zoneId: "zone_wiqar_1",
    stationId: "stn_wiqar_1",
    kioskId: null,
    reportsTo: null,
    active: true,
  } as const;

  return [
    {
      ...base,
      _id: "usr_admin_wayz",
      email: "admin.wayz@lockerflow.demo",
      passwordHash: hashPassword("Admin@123"),
      fullName: "Nasser Al-Wayz",
      role: "TENANT_ADMIN",
      phone: "0550000010",
    },
    {
      ...base,
      _id: "usr_pm_wayz",
      email: "projects.wayz@lockerflow.demo",
      passwordHash: hashPassword("Project@123"),
      fullName: "Rayan Al-Dosari",
      role: "PROJECT_MANAGER",
      phone: "0550000015",
    },
    {
      ...base,
      _id: "usr_acct_wayz",
      email: "accountant.wayz@lockerflow.demo",
      passwordHash: hashPassword("Account@123"),
      fullName: "Yara Al-Ghamdi",
      role: "ACCOUNTANT",
      phone: "0550000020",
    },
    {
      ...base,
      _id: "usr_hr_wayz",
      email: "hr.wayz@lockerflow.demo",
      passwordHash: hashPassword("People@123"),
      fullName: "Mona Al-Rashid",
      role: "HR",
      phone: "0550000030",
    },

    {
      ...base,
      _id: "usr_mgr_wayz",
      email: "manager.wayz@lockerflow.demo",
      passwordHash: hashPassword("Manager@123"),
      fullName: "Faisal Al-Mutairi",
      role: "MANAGER",
      engineKinds: ["SHOP_AND_DROP", "MOBILITY"],
      reportsTo: "usr_pm_wayz",
      phone: "0550000003",
    },
    {
      ...base,
      _id: "usr_mgr_lagoon_wayz",
      email: "lagoon.manager.wayz@lockerflow.demo",
      passwordHash: hashPassword("Manager@123"),
      fullName: "Amal Al-Harthy",
      role: "MANAGER",
      engineKinds: ["LAGOON"],
      reportsTo: "usr_pm_wayz",
      phone: "0550000016",
    },

    {
      ...base,
      _id: "usr_sup_wayz",
      email: "supervisor.wayz@lockerflow.demo",
      passwordHash: hashPassword("Super@123"),
      fullName: "Tariq Al-Anazi",
      role: "SUPERVISOR",
      engineKinds: ["SHOP_AND_DROP", "MOBILITY"],
      reportsTo: "usr_mgr_wayz",
      phone: "0550000017",
    },
    {
      ...base,
      _id: "usr_sup_lagoon_wayz",
      email: "lagoon.supervisor.wayz@lockerflow.demo",
      passwordHash: hashPassword("Super@123"),
      fullName: "Nouf Al-Shammari",
      role: "SUPERVISOR",
      engineKinds: ["LAGOON"],
      reportsTo: "usr_mgr_lagoon_wayz",
      phone: "0550000018",
    },

    {
      ...base,
      _id: "usr_welcome_wayz",
      email: "welcome.wayz@lockerflow.demo",
      passwordHash: hashPassword("Lagoon@123"),
      fullName: "Huda Al-Qahtani",
      role: "AGENT",
      engineKinds: ["LAGOON"],
      kioskId: "ksk_wayz_mountain",
      phone: "0550000004",
    },
    {
      ...base,
      _id: "usr_captain_wayz",
      email: "captain.wayz@lockerflow.demo",
      passwordHash: hashPassword("Lagoon@123"),
      fullName: "Saad Al-Balawi",
      role: "CHIEF_CAPTAIN",
      engineKinds: ["LAGOON"],
      kioskId: "ksk_wayz_france",
      phone: "0550000019",
    },

    {
      ...base,
      _id: "usr_agent_wayz",
      email: "agent.wayz@lockerflow.demo",
      passwordHash: hashPassword("Agent@123"),
      fullName: "Omar Al-Wayz",
      role: "AGENT",
      engineKinds: ["SHOP_AND_DROP"],
      kioskId: "ksk_wayz_iran",
      phone: "0550000001",
    },
    {
      ...base,
      _id: "usr_agent_till_wayz",
      email: "agent.morocco.wayz@lockerflow.demo",
      passwordHash: hashPassword("Agent@123"),
      fullName: "Reem Al-Sudairi",
      role: "AGENT",
      engineKinds: ["SHOP_AND_DROP"],
      kioskId: "ksk_wayz_morocco",
      phone: "0550000007",
    },
    {
      ...base,
      _id: "usr_agent_gate1_wayz",
      email: "agent.gate1.wayz@lockerflow.demo",
      passwordHash: hashPassword("Agent@123"),
      fullName: "Majed Al-Subaie",
      role: "AGENT",
      engineKinds: ["MOBILITY"],
      kioskId: "ksk_wayz_gate1",
      phone: "0550000008",
    },
    {
      ...base,
      _id: "usr_agent_egypt_wayz",
      email: "agent.egypt.wayz@lockerflow.demo",
      passwordHash: hashPassword("Agent@123"),
      fullName: "Lina Al-Faraj",
      role: "AGENT",
      engineKinds: ["LAGOON"],
      kioskId: "ksk_wayz_egypt",
      phone: "0550000009",
    },

    {
      ...base,
      _id: "usr_courier_wayz",
      email: "courier.wayz@lockerflow.demo",
      passwordHash: hashPassword("Courier@123"),
      fullName: "Bilal Al-Harbi",
      role: "DELIVERY_AGENT",
      phone: "0550000005",
    },
    {
      ...base,
      _id: "usr_courier2_wayz",
      email: "courier2.wayz@lockerflow.demo",
      passwordHash: hashPassword("Courier@123"),
      fullName: "Khalid Al-Otaibi",
      role: "DELIVERY_AGENT",
      phone: "0550000006",
    },

    {
      ...wiqar,
      _id: "usr_admin_wiqar",
      email: "admin.wiqar@lockerflow.demo",
      passwordHash: hashPassword("Admin@123"),
      fullName: "Dana Al-Wiqar",
      role: "TENANT_ADMIN",
      phone: "0550000011",
    },
    {
      ...wiqar,
      _id: "usr_acct_wiqar",
      email: "accountant.wiqar@lockerflow.demo",
      passwordHash: hashPassword("Account@123"),
      fullName: "Tariq Al-Zahrani",
      role: "ACCOUNTANT",
      phone: "0550000021",
    },
    {
      ...wiqar,
      _id: "usr_hr_wiqar",
      email: "hr.wiqar@lockerflow.demo",
      passwordHash: hashPassword("People@123"),
      fullName: "Faris Al-Wiqar",
      role: "HR",
      phone: "0550000031",
    },
    {
      ...wiqar,
      _id: "usr_mgr_wiqar",
      email: "manager.wiqar@lockerflow.demo",
      passwordHash: hashPassword("Manager@123"),
      fullName: "Salma Al-Wiqar",
      role: "MANAGER",
      engineKinds: ["SHOP_AND_DROP", "MOBILITY", "LAGOON"],
      phone: "0550000012",
    },
    {
      ...wiqar,
      _id: "usr_agent_wiqar",
      email: "agent.wiqar@lockerflow.demo",
      passwordHash: hashPassword("Agent@123"),
      fullName: "Layla Al-Wiqar",
      role: "AGENT",
      engineKinds: ["SHOP_AND_DROP"],
      kioskId: "ksk_wiqar_1",
      phone: "0550000002",
    },
    {
      ...wiqar,
      _id: "usr_agent_till_wiqar",
      email: "agent.marina.wiqar@lockerflow.demo",
      passwordHash: hashPassword("Agent@123"),
      fullName: "Rakan Al-Wiqar",
      role: "AGENT",
      engineKinds: ["LAGOON"],
      kioskId: "ksk_wiqar_lagoon",
      phone: "0550000013",
    },
    {
      ...wiqar,
      _id: "usr_kmgr_wiqar",
      email: "lagoon.wiqar@lockerflow.demo",
      passwordHash: hashPassword("Lagoon@123"),
      fullName: "Maha Al-Wiqar",
      role: "AGENT",
      engineKinds: ["LAGOON"],
      kioskId: "ksk_wiqar_lagoon",
      phone: "0550000014",
    },
  ];
}

export async function seedFresh() {
  await Promise.all([
    Tenant.deleteMany({}),
    Site.deleteMany({}),
    Zone.deleteMany({}),
    Station.deleteMany({}),
    Kiosk.deleteMany({}),
    Counter.deleteMany({}),
    DeliveryRequest.deleteMany({}),
    CashMovement.deleteMany({}),
    Expense.deleteMany({}),
    Season.deleteMany({}),
    CardTransaction.deleteMany({}),
    CommissionRate.deleteMany({}),
    User.deleteMany({}),
    Customer.deleteMany({}),
    CatalogueProduct.deleteMany({}),
    AssetType.deleteMany({}),
    AssetUnit.deleteMany({}),
    Order.deleteMany({}),
    Booking.deleteMany({}),
    Payment.deleteMany({}),
    Receipt.deleteMany({}),
    Shift.deleteMany({}),
    Audit.deleteMany({}),
    Notification.deleteMany({}),
    ManualSale.deleteMany({}),
    RefundRequest.deleteMany({}),
    InvoiceDoc.deleteMany({}),
    Trip.deleteMany({}),
    Version.deleteMany({}),
  ]);

  await Tenant.insertMany(tenantRows([
    {
      _id: "wayz",
      name: "WAYZ",
      legalName: "Wayz Rentals Co.",
      crNumber: "7015501021",
      vatNumber: "310917702200003",
      enabledEngines: DEMO_ENGINES,
      currency: "SAR",
      vatRate: 0.15,
      rentalRules: DEFAULT_RENTAL_RULES,
      penaltySchedule: DEFAULT_PENALTY_SCHEDULE,
      branding: {
        primaryColor: "#14b8a6",
        secondaryColor: "#0f766e",
        accentColor: "#f5a623",
        fontFamily: "system-ui, Segoe UI, Roboto, sans-serif",
        logoText: "WZ",
      },
    },
    {
      _id: "wiqar",
      name: "WIQAR",
      legalName: "Wiqar Experiences Ltd.",
      crNumber: "7016602033",
      vatNumber: "310917702200099",
      enabledEngines: ALL_ENGINES,
      currency: "SAR",
      vatRate: 0.15,
      rentalRules: DEFAULT_RENTAL_RULES,
      penaltySchedule: DEFAULT_PENALTY_SCHEDULE,
      branding: {
        primaryColor: "#7c3aed",
        secondaryColor: "#5b21b6",
        accentColor: "#f59e0b",
        fontFamily: "system-ui, Segoe UI, Roboto, sans-serif",
        logoText: "WQ",
      },
    },
  ]));

  await Site.insertMany(onlySeeded([
    {
      _id: "site_wayz_1",
      tenantId: "wayz",
      name: "Boulevard World",
      city: "Riyadh",
      venueType: "FESTIVAL",
      address: "Boulevard World, Riyadh Season grounds",
      contactPhone: "0112223344",
      active: true,
    },
    {
      _id: "site_wayz_2",
      tenantId: "wayz",
      name: "Winter Wonderland",
      city: "Jeddah",
      venueType: "FESTIVAL",
      address: "Jeddah Season grounds, North Obhur",
      contactPhone: "0122229999",
      active: true,
    },
    {
      _id: "site_wiqar_2",
      tenantId: "wiqar",
      name: "Jeddah Corniche Walk",
      city: "Jeddah",
      venueType: "MALL",
      address: "Corniche Road, Al Shatie",
      contactPhone: "0126667788",
      active: true,
    },
    {
      _id: "site_wiqar_1",
      tenantId: "wiqar",
      name: "Jeddah Waterfront",
      city: "Jeddah",
      venueType: "MALL",
      active: true,
    },
  ]));

  await Zone.insertMany(onlySeeded([
    { _id: "zone_wayz_1", tenantId: "wayz", siteId: "site_wayz_1", name: "Boulevard World grounds" },
    { _id: "zone_wiqar_1", tenantId: "wiqar", siteId: "site_wiqar_1", name: "Marina Deck" },
  ]));

  await Station.insertMany(onlySeeded([
    {
      _id: "stn_wayz_1",
      tenantId: "wayz",
      siteId: "site_wayz_1",
      zoneId: "zone_wayz_1",
      name: "Boulevard World — Riyadh Season",
      code: "BLV",
      engineKinds: ALL_ENGINES,
      openingTime: "09:00",
      closingTime: "23:00",
      active: true,
      mapX: 0.42,
      mapY: 0.5,
    },
    {
      _id: "stn_wayz_2",
      tenantId: "wayz",
      siteId: "site_wayz_2",
      zoneId: "",
      name: "Winter Wonderland — Jeddah Season",
      code: "WWL",
      engineKinds: ["SHOP_AND_DROP", "MOBILITY"],
      openingTime: "16:00",
      closingTime: "01:00",
      active: true,
    },
    {
      _id: "stn_wiqar_2",
      tenantId: "wiqar",
      siteId: "site_wiqar_2",
      zoneId: "",
      name: "Corniche Walk — Promenade",
      code: "CRN-1",
      engineKinds: ["SHOP_AND_DROP", "MOBILITY"],
      openingTime: "10:00",
      closingTime: "23:59",
      active: true,
    },
    {
      _id: "stn_wiqar_1",
      tenantId: "wiqar",
      siteId: "site_wiqar_1",
      zoneId: "zone_wiqar_1",
      name: "Marina Station 1",
      engineKinds: ALL_ENGINES,
      active: true,
    },
  ]));

  await Kiosk.insertMany(onlySeeded([
    ...shopAndDropKiosks(),
    ...mobilityKiosks(),
    ...lagoonKiosks(),
    {
      _id: "ksk_wayz_ww_sd",
      tenantId: "wayz",
      siteId: "site_wayz_2",
      stationId: "stn_wayz_2",
      name: "Wonderland Bag Drop",
      code: "WWL-SD",
      location: "Main gate, beside the ticket office",
      engineKind: "SHOP_AND_DROP",
      active: true,
    },
    {
      _id: "ksk_wayz_ww_mob",
      tenantId: "wayz",
      siteId: "site_wayz_2",
      stationId: "stn_wayz_2",
      name: "Wonderland Vehicle Bay",
      code: "WWL-MB",
      location: "North car park",
      engineKind: "MOBILITY",
      active: true,
    },
    {
      _id: "ksk_wiqar_2",
      tenantId: "wiqar",
      siteId: "site_wiqar_2",
      stationId: "stn_wiqar_2",
      name: "Promenade Kiosk",
      code: "CRN-1-A",
      location: "Beside the fountain",
      engineKind: "SHOP_AND_DROP",
      active: true,
    },
    {
      _id: "ksk_wiqar_1",
      tenantId: "wiqar",
      siteId: "site_wiqar_1",
      stationId: "stn_wiqar_1",
      name: "Marina Kiosk",
      code: "MAR-1",
      engineKind: "SHOP_AND_DROP",
      active: true,
    },
    {
      _id: "ksk_wiqar_lagoon",
      tenantId: "wiqar",
      siteId: "site_wiqar_1",
      stationId: "stn_wiqar_1",
      name: "Marina Jetty",
      code: "MAR-LG",
      engineKind: "LAGOON",
      active: true,
    },
  ]));

  await User.insertMany(onlySeeded(demoUsers()));

  const types = onlyRunEngines(onlySeeded([...assetTypes("wayz"), ...assetTypes("wiqar")]));
  const typeIds = new Set(types.map((t) => String((t as { _id: string })._id)));
  await AssetType.insertMany(types);
  const wayzUnits = assetUnits("wayz", "stn_wayz_1").map((u, i) => ({
    ...u,
    kioskId: boulevardDeskFor(String((u as { assetTypeId: string }).assetTypeId), i),
  }));
  const jeddahUnits = assetUnits("wayz", "stn_wayz_2")
    .filter((u) => {
      const type = String((u as { assetTypeId: string }).assetTypeId);
      return type.includes("cmp") || type.includes("veh");
    })
    .map((u) => {
      const type = String((u as { assetTypeId: string }).assetTypeId);
      return {
        ...u,
        _id: `${u._id}_ww`,
        identifier: `${u.identifier}W`,
        kioskId: type.includes("cmp") ? "ksk_wayz_ww_sd" : "ksk_wayz_ww_mob",
      };
    });

  await AssetUnit.insertMany(onlySeeded([
    ...wayzUnits,
    ...jeddahUnits,
    ...assetUnits("wiqar", "stn_wiqar_1").map((u) => ({
      ...u,
      kioskId: String((u as { assetTypeId: string }).assetTypeId).includes("boat") ? "ksk_wiqar_lagoon" : "ksk_wiqar_1",
    })),
    ...assetUnits("wiqar", "stn_wiqar_2")
      .filter((u) => String((u as { assetTypeId: string }).assetTypeId).includes("cmp"))
      .map((u) => ({
        ...u,
        _id: `${u._id}_b`,
        identifier: `${u.identifier}B`,
        kioskId: "ksk_wiqar_2",
      })),
  ]).filter((u) => typeIds.has(String((u as unknown as { assetTypeId: string }).assetTypeId))));
  await CatalogueProduct.insertMany(
    onlyRunEngines(onlySeeded([...products("wayz"), ...products("wiqar")])),
  );
  await Customer.insertMany(onlySeeded([
    {
      _id: "cust_wayz_whatsapp",
      tenantId: "wayz",
      name: "Mouad Houmada",
      phone: "+212 628436082",
      email: "mouadhoumada@gmail.com",
      createdAt: new Date(Date.now() - 86400000),
    },
    {
      _id: "cust_wayz_1",
      tenantId: "wayz",
      name: "Ahmed Saleh",
      phone: "0599709998",
      createdAt: new Date(Date.now() - 3 * 86400000),
    },
    {
      _id: "cust_wayz_2",
      tenantId: "wayz",
      name: "Sara Kamal",
      phone: "0561234567",
      createdAt: new Date(Date.now() - 2 * 86400000),
    },
    {
      _id: "cust_wayz_3",
      tenantId: "wayz",
      name: "Nora Hassan",
      phone: "0512223344",
      createdAt: new Date(Date.now() - 86400000),
    },
    {
      _id: "cust_wiqar_2",
      tenantId: "wiqar",
      name: "Hessa Al-Amoudi",
      phone: "0544455566",
      createdAt: new Date(Date.now() - 2 * 86400000),
    },
    {
      _id: "cust_wiqar_1",
      tenantId: "wiqar",
      name: "Yusuf Marina",
      phone: "0538889900",
      createdAt: new Date(Date.now() - 86400000),
    },
  ]));

  await Shift.create({
    _id: "shift_wayz_open",
    tenantId: "wayz",
    stationId: "stn_wayz_1",
    agentId: "usr_agent_wayz",
    status: "OPEN",
    openedAt: new Date(Date.now() - 8 * HOUR),
    expectedCash: 0,
  });

  const demoLarge = await freeUnitAt("ksk_wayz_iran", "at_wayz_cmp_l");
  const order = await Order.create({
    _id: "ord-0001",
    ref: "100011",
    tenantId: "wayz",
    stationId: "stn_wayz_1",
    agentId: "usr_agent_wayz",
    customerId: "cust_wayz_1",
    engineKind: "SHOP_AND_DROP",
    lines: [
      {
        productId: "pr_wayz_sd_l",
        name: "Shop & Drop — L (3 bags)",
        quantity: 1,
        unitPrice: 60,
        isDeposit: false,
        taxable: true,
      },
    ],
    status: "PAID",
    subtotal: 52.17,
    vat: 7.83,
    depositTotal: 0,
    total: 60,
    hold: null,
  });
  const demoTax = splitInclusive(60);
  await Payment.create({
    _id: "pay-0001",
    tenantId: "wayz",
    stationId: "stn_wayz_1",
    kioskId: "ksk_wayz_iran",
    orderId: order._id,
    bookingId: "bk-0001",
    amount: demoTax.total,
    baseAmount: demoTax.base,
    vatAmount: demoTax.vat,
    vatRate: VAT_RATE,
    engineKind: "SHOP_AND_DROP",
    method: "CARD",
    cardScheme: "MADA",
    kind: "SALE",
    status: "CAPTURED",
    takenBy: "usr_agent_wayz",
    shiftId: "shift_wayz_open",
  });
  await Booking.create({
    _id: "bk-0001",
    ref: "SD-100011",
    tenantId: "wayz",
    stationId: "stn_wayz_1",
    agentId: "usr_agent_wayz",
    orderId: order._id,
    customerId: "cust_wayz_1",
    customerName: "Ahmed Saleh",
    customerPhone: "0599709998",
    engineKind: "SHOP_AND_DROP",
    kioskId: "ksk_wayz_iran",
    productName: "Shop & Drop — L (3 bags)",
    status: "ACTIVE",
    bags: [1, 2, 3].map((i) => ({
      index: i,
      category: "SOFT",
      description: ["Backpack", "Duffel", "Shopping bag"][i - 1],
      dimensions: { w: 30, h: 25, d: 20 },
      weight: 3,
      barcode: `78${i}45012398${i}0`,
      status: "STORED",
      assignedUnitId: demoLarge._id,
    })),
    session: {
      kind: "STORAGE",
      status: "ACTIVE",
      assetUnitId: demoLarge._id,
      requestedDurationMin: 120,
      startedAt: new Date(Date.now() - 80 * MIN),
      expectedEndAt: new Date(Date.now() + 40 * MIN),
      gracePeriodMin: 5,
      overtimeHourlyRate: 30,
      expiryWarningSentAt: null,
    },
    reservation: {
      assetUnitId: demoLarge._id,
      expiresAt: new Date(Date.now() + HOUR),
      status: "CONSUMED",
    },
    assetUnitId: demoLarge._id,
    packingPlan: {
      requiredCapacityScore: 63,
      suggestedAssetTypeId: "at_wayz_cmp_l",
      numberOfCompartmentsRequired: 1,
      allocations: [{ compartmentIndex: 0, bagIndexes: [1, 2, 3] }],
      priceCalculationSummary: "1 compartment(s) × 60 (PER_COMPARTMENT)",
    },
    custody: [
      {
        from: "CUSTOMER",
        to: "AGENT",
        at: new Date(Date.now() - 85 * MIN),
        note: "Bags received at desk",
      },
      {
        from: "AGENT",
        to: "LOCKER",
        at: new Date(Date.now() - 80 * MIN),
        note: "Stored — timer started",
      },
    ],
    metadata: { assetTypeId: "at_wayz_cmp_l" },
  });
  await AssetUnit.updateOne(
    { _id: demoLarge._id },
    { $set: { status: "OCCUPIED", currentBookingId: "bk-0001" } },
  );
  await Receipt.create({
    ref: "100011",
    tenantId: "wayz",
    stationId: "stn_wayz_1",
    orderId: order._id,
    bookingId: "bk-0001",
    kind: "SALE",
    qrPayload: "ZATCA|WAYZ|100011|60.00",
  });

  await seedStoredElsewhere({
    orderId: "ord-multi-morocco",
    bookingId: "bk-multi-morocco",
    ref: "SD-100031",
    kioskId: "ksk_wayz_morocco",
    agentId: "usr_agent_morocco_wayz",
    assetTypeId: "at_wayz_cmp_m",
    productId: "pr_wayz_sd_m",
    productName: "Shop & Drop — M (2 bags)",
    price: 45,
    bags: ["Tote bag", "Carrier bag"],
    barcodePrefix: "9012",
  });

  await seedStoredElsewhere({
    orderId: "ord-multi-levant",
    bookingId: "bk-multi-levant",
    ref: "SD-100032",
    kioskId: "ksk_wayz_levant",
    agentId: "usr_agent_wayz",
    assetTypeId: "at_wayz_cmp_s",
    productId: "pr_wayz_sd_s",
    productName: "Shop & Drop — S (1 bag)",
    price: 30,
    bags: ["Gift box"],
    barcodePrefix: "9013",
  });

  await Order.create({
    _id: "ord-0002",
    ref: "100012",
    tenantId: "wayz",
    stationId: "stn_wayz_1",
    agentId: "usr_agent_wayz",
    customerId: "cust_wayz_2",
    engineKind: "SHOP_AND_DROP",
    lines: [{ productId: "pr_wayz_sd_m", name: "Shop & Drop — M (2 bags)", quantity: 1, unitPrice: 45, isDeposit: false, taxable: true }],
    status: "PAID",
    subtotal: 39.13,
    vat: 5.87,
    depositTotal: 0,
    total: 45,
    hold: null,
  });
  const demoMedium = await freeUnitAt("ksk_wayz_iran", "at_wayz_cmp_m");
  await Booking.create({
    _id: "bk-0002",
    ref: "SD-100012",
    tenantId: "wayz",
    stationId: "stn_wayz_1",
    agentId: "usr_agent_wayz",
    orderId: "ord-0002",
    customerId: "cust_wayz_2",
    customerName: "Sara Kamal",
    customerPhone: "0561234567",
    customerEmail: "sara.kamal@example.com",
    engineKind: "SHOP_AND_DROP",
    productName: "Shop & Drop — M (2 bags)",
    status: "ACTIVE",
    bags: [1, 2].map((i) => ({
      index: i,
      category: "SOFT",
      description: ["Cabin trolley", "Tote bag"][i - 1],
      dimensions: { w: 35, h: 30, d: 20 },
      weight: 5,
      barcode: `78${i}45077712${i}0`,
      status: "STORED",
      assignedUnitId: demoMedium._id,
    })),
    session: {
      kind: "STORAGE",
      status: "ACTIVE",
      assetUnitId: demoMedium._id,
      requestedDurationMin: 240,
      startedAt: new Date(Date.now() - 50 * MIN),
      expectedEndAt: new Date(Date.now() + 190 * MIN),
      gracePeriodMin: 5,
      overtimeHourlyRate: 25,
      expiryWarningSentAt: null,
    },
    reservation: { assetUnitId: demoMedium._id, expiresAt: new Date(Date.now() + HOUR), status: "CONSUMED" },
    assetUnitId: demoMedium._id,
    packingPlan: null,
    custody: [
      { from: "CUSTOMER", to: "AGENT", at: new Date(Date.now() - 55 * MIN), note: "Bags received at desk" },
      { from: "AGENT", to: "LOCKER", at: new Date(Date.now() - 50 * MIN), note: "Stored — timer started" },
    ],
    metadata: { assetTypeId: "at_wayz_cmp_m", kioskId: "ksk_wayz_iran" },
  });
  await AssetUnit.updateOne({ _id: demoMedium._id }, { $set: { status: "OCCUPIED", currentBookingId: "bk-0002" } });

  await DeliveryRequest.create({
    _id: "dlv-0001",
    tenantId: "wayz",
    siteId: "site_wayz_1",
    stationId: "stn_wayz_1",
    kioskId: "ksk_wayz_iran",
    bookingId: "bk-0002",
    bookingRef: "SD-100012",
    customerId: "cust_wayz_2",
    customerName: "Sara Kamal",
    customerPhone: "0561234567",
    destination: {
      address: "Rosewood Hotel, Level 3 reception, Boulevard Riyadh City",
      notes: "Ask for Sara at the front desk — she is in meetings until 18:00.",
      contactPhone: "0561234567",
    },
    status: "REQUESTED",
    origin: "AT_STORAGE",
    verifiedBy: null,
    verifiedAt: null,
    verificationMethod: null,
    requestedBy: "usr_agent_wayz",
    requestedAt: new Date(Date.now() - 12 * MIN),
    assetUnitId: demoMedium._id,
    assetUnitIdentifier: demoMedium.identifier,
    fee: 25,
    timeline: [
      { status: "REQUESTED", at: new Date(Date.now() - 12 * MIN), by: "usr_agent_wayz", note: "Requested (at the desk)" },
    ],
  });

  await Booking.create({
    _id: "bk-0003",
    ref: "SD-100010",
    tenantId: "wayz",
    stationId: "stn_wayz_1",
    agentId: "usr_agent_wayz",
    orderId: "ord-0002",
    customerId: "cust_wayz_3",
    customerName: "Nora Hassan",
    customerPhone: "0512223344",
    customerEmail: "nora.hassan@example.com",
    engineKind: "SHOP_AND_DROP",
    productName: "Shop & Drop — S (1 bag)",
    status: "COMPLETED",
    bags: [
      {
        index: 1,
        category: "SOFT",
        description: "Weekend holdall",
        dimensions: { w: 40, h: 25, d: 25 },
        weight: 6,
        barcode: "7845099911230",
        status: "DELIVERED",
        assignedUnitId: null,
      },
    ],
    session: {
      kind: "STORAGE",
      status: "COMPLETED",
      assetUnitId: null,
      requestedDurationMin: 180,
      startedAt: new Date(Date.now() - 6 * HOUR),
      expectedEndAt: new Date(Date.now() - 3 * HOUR),
      chargeableEndedAt: new Date(Date.now() - 3 * HOUR),
      gracePeriodMin: 5,
      overtimeHourlyRate: 20,
      expiryWarningSentAt: null,
    },
    reservation: null,
    assetUnitId: null,
    packingPlan: null,
    custody: [
      { from: "CUSTOMER", to: "AGENT", at: new Date(Date.now() - 6 * HOUR), note: "Bags received at desk" },
      { from: "AGENT", to: "LOCKER", at: new Date(Date.now() - 6 * HOUR), note: "Stored — timer started" },
      { from: "LOCKER", to: "PORTER", at: new Date(Date.now() - 4 * HOUR), note: "Collected by courier for dlv-0002" },
      { from: "PORTER", to: "CUSTOMER", at: new Date(Date.now() - 3 * HOUR), note: "Delivered to Marriott Riyadh, room 812" },
    ],
    metadata: { assetTypeId: "at_wayz_cmp_s" },
  });
  const demoSmall = await freeUnitAt("ksk_wayz_iran", "at_wayz_cmp_s");
  await DeliveryRequest.create({
    _id: "dlv-0002",
    tenantId: "wayz",
    siteId: "site_wayz_1",
    stationId: "stn_wayz_1",
    kioskId: "ksk_wayz_morocco",
    bookingId: "bk-0003",
    bookingRef: "SD-100010",
    customerId: "cust_wayz_3",
    customerName: "Nora Hassan",
    customerPhone: "0512223344",
    destination: { address: "Marriott Riyadh, room 812", notes: "Leave with the concierge.", contactPhone: "0512223344" },
    status: "DELIVERED",
    origin: "CUSTOMER_CONTACT",
    verifiedBy: "usr_agent_wayz",
    verifiedAt: new Date(Date.now() - 4.5 * HOUR),
    verificationMethod: "WHATSAPP_OTP",
    requestedBy: "usr_agent_wayz",
    requestedAt: new Date(Date.now() - 4.5 * HOUR),
    assignedTo: "usr_courier_wayz",
    assignedAt: new Date(Date.now() - 4.4 * HOUR),
    releaseRequestedAt: new Date(Date.now() - 4.1 * HOUR),
    releaseApprovedBy: "usr_agent_wayz",
    releaseApprovedAt: new Date(Date.now() - 4 * HOUR),
    compartmentCode: null,
    compartmentCodeExpiresAt: null,
    assetUnitId: demoSmall._id,
    assetUnitIdentifier: demoSmall.identifier,
    pickedUpAt: new Date(Date.now() - 4 * HOUR),
    scannedBarcodes: ["7845099911230"],
    deliveredAt: new Date(Date.now() - 3 * HOUR),
    failureReason: null,
    fee: 25,
    timeline: [
      { status: "REQUESTED", at: new Date(Date.now() - 4.5 * HOUR), by: "usr_agent_wayz", note: "Requested (by phone)" },
      { status: "ASSIGNED", at: new Date(Date.now() - 4.4 * HOUR), by: "usr_courier_wayz", note: "Claimed by courier" },
      { status: "RELEASE_REQUESTED", at: new Date(Date.now() - 4.1 * HOUR), by: "usr_courier_wayz", note: "Courier at the kiosk requesting the bags" },
      { status: "RELEASE_APPROVED", at: new Date(Date.now() - 4 * HOUR), by: "usr_agent_wayz", note: "Kiosk agent confirmed the courier and released the compartment" },
      { status: "PICKED_UP", at: new Date(Date.now() - 4 * HOUR), by: "usr_courier_wayz", note: "1 bag(s) collected" },
      { status: "DELIVERED", at: new Date(Date.now() - 3 * HOUR), by: "usr_courier_wayz", note: "Handed to the customer" },
    ],
  });

  await Shift.create({
    _id: "shift_wayz_cashier",
    tenantId: "wayz",
    stationId: "stn_wayz_1",
    agentId: "usr_agent_till_wayz",
    status: "OPEN",
    openedAt: new Date(Date.now() - 5 * HOUR),
    expectedCash: 180,
  });
  await CashMovement.insertMany([
    {
      _id: "cm-0001",
      tenantId: "wayz",
      stationId: "stn_wayz_1",
      shiftId: "shift_wayz_cashier",
      actorId: "usr_agent_till_wayz",
      kind: "FLOAT_IN",
      amount: 500,
      reason: "Opening float for the morning shift",
      reference: "SAFE-01",
      createdAt: new Date(Date.now() - 5 * HOUR),
    },
    {
      _id: "cm-0002",
      tenantId: "wayz",
      stationId: "stn_wayz_1",
      shiftId: "shift_wayz_cashier",
      actorId: "usr_agent_till_wayz",
      kind: "PAY_OUT",
      amount: 120,
      reason: "Replacement barcode label rolls",
      reference: "INV-8841",
      createdAt: new Date(Date.now() - 3 * HOUR),
    },
    {
      _id: "cm-0003",
      tenantId: "wayz",
      stationId: "stn_wayz_1",
      shiftId: "shift_wayz_cashier",
      actorId: "usr_agent_till_wayz",
      kind: "DROP",
      amount: 200,
      reason: "Midday banking drop — drawer above the safe limit",
      reference: "BAG-2291",
      createdAt: new Date(Date.now() - 1 * HOUR),
    },
  ]);

  for (const q of [
    { id: "bk-0004", order: "ord-0003", ref: "SD-100013", customer: "cust_wayz_3", name: "Nora Hassan", phone: "0512223344", price: 45, product: "pr_wayz_sd_m", label: "Shop & Drop — M (2 bags)", bags: 2, minsAgo: 9 },
    { id: "bk-0005", order: "ord-0004", ref: "SD-100014", customer: "cust_wayz_1", name: "Ahmed Saleh", phone: "0599709998", price: 30, product: "pr_wayz_sd_s", label: "Shop & Drop — S (1 bag)", bags: 1, minsAgo: 3 },
  ]) {
    const sub = Number((q.price / 1.15).toFixed(2));
    await Order.create({
      _id: q.order,
      ref: q.ref.replace("SD-", ""),
      tenantId: "wayz",
      stationId: "stn_wayz_1",
      agentId: "usr_agent_wayz",
      customerId: q.customer,
      engineKind: "SHOP_AND_DROP",
      lines: [{ productId: q.product, name: q.label, quantity: 1, unitPrice: q.price, isDeposit: false, taxable: true }],
      status: "DRAFT",
      subtotal: sub,
      vat: Number((q.price - sub).toFixed(2)),
      depositTotal: 0,
      total: q.price,
      hold: null,
      createdAt: new Date(Date.now() - q.minsAgo * MIN),
    });
    await Booking.create({
      _id: q.id,
      ref: q.ref,
      tenantId: "wayz",
      stationId: "stn_wayz_1",
      agentId: "usr_agent_wayz",
      orderId: q.order,
      customerId: q.customer,
      customerName: q.name,
      customerPhone: q.phone,
      engineKind: "SHOP_AND_DROP",
      productName: q.label,
      status: "DRAFT",
      bags: Array.from({ length: q.bags }, (_, i) => ({
        index: i + 1,
        category: "SOFT",
        description: ["Cabin trolley", "Rucksack"][i] ?? `Bag ${i + 1}`,
        dimensions: { w: 32, h: 26, d: 18 },
        weight: 4,
        barcode: `79${i + 1}4508812${i + 1}0${q.bags}`,
        status: "REGISTERED",
        assignedUnitId: null,
      })),
      session: {
        kind: "STORAGE",
        status: "DRAFT",
        assetUnitId: null,
        requestedDurationMin: 120,
        startedAt: null,
        expectedEndAt: null,
        gracePeriodMin: 5,
        overtimeHourlyRate: 25,
        expiryWarningSentAt: null,
      },
      reservation: null,
      assetUnitId: null,
      packingPlan: null,
      custody: [],
      metadata: { assetTypeId: q.bags > 1 ? "at_wayz_cmp_m" : "at_wayz_cmp_s" },
      createdAt: new Date(Date.now() - q.minsAgo * MIN),
    });
  }

  await stampDesks();
  await seedFinancialHistory();
  await seedCostHistory();
  await seedNotifications();
  await seedManualSales();

  await Counter.insertMany([
    { _id: "expense", seq: 2000 },
    { _id: "payment", seq: 5000 },
    { _id: "cardTransaction", seq: 4000 },
    { _id: "season", seq: 2 },
    { _id: "booking", seq: 5 },
    { _id: "order", seq: 4 },
    { _id: "delivery", seq: 2 },
    { _id: "cashMovement", seq: 3 },
    { _id: "manualSale", seq: 2 },
  ]);
  await seedVersions();


  logger.info("Seed complete", { tenants: SEEDED_TENANTS.length, deliveries: 2, queued: 2 });
}

async function stampDesks() {
  for (const user of onlySeeded(demoUsers())) {
    if (!user.kioskId) continue;
    await Promise.all([
      Booking.updateMany({ agentId: user._id, kioskId: null }, { $set: { kioskId: user.kioskId } }),
      Order.updateMany({ agentId: user._id, kioskId: null }, { $set: { kioskId: user.kioskId } }),
      Payment.updateMany({ takenBy: user._id, kioskId: null }, { $set: { kioskId: user.kioskId } }),
    ]);
  }
}

async function seedNotifications() {
  await Notification.insertMany(onlySeeded([
    {
      _id: "ntf_seed_1",
      tenantId: "wayz",
      stationId: "stn_wayz_1",
      kioskId: "ksk_wayz_iran",
      engineKind: "SHOP_AND_DROP",
      title: "Bag drop ending soon",
      body: "SD-100012 ends in about 25 minutes. The customer has been warned on WhatsApp.",
      level: "info",
      audience: [],
      link: "/bookings/bk-0002",
      readBy: [],
      createdAt: new Date(Date.now() - 12 * MIN),
    },
    {
      _id: "ntf_seed_2",
      tenantId: "wayz",
      stationId: "stn_wayz_1",
      kioskId: null,
      engineKind: "MOBILITY",
      title: "Scooter taken out of service",
      body: "SC-03 was reported with a soft rear tyre and moved to maintenance.",
      level: "warning",
      audience: ["SUPERVISOR", "MANAGER", "PROJECT_MANAGER", "TENANT_ADMIN"],
      link: "/assets",
      readBy: [],
      createdAt: new Date(Date.now() - 90 * MIN),
    },
    {
      _id: "ntf_seed_3",
      tenantId: "wayz",
      stationId: "",
      kioskId: null,
      engineKind: null,
      title: "Season rules reviewed",
      body: "Grace stays at 15 minutes in the system and 10 minutes to the customer.",
      level: "success",
      audience: ["TENANT_ADMIN", "PROJECT_MANAGER"],
      link: "/admin/rules",
      readBy: [],
      createdAt: new Date(Date.now() - 6 * HOUR),
    },
  ]));
}

async function seedManualSales() {
  const gross = (total: number) => {
    const base = Math.round((total / 1.15) * 100) / 100;
    return { amount: total, baseAmount: base, vatAmount: Math.round((total - base) * 100) / 100, vatRate: 0.15 };
  };

  await ManualSale.insertMany(onlySeeded([
    {
      _id: "man-0001",
      ref: "MAN-0001",
      tenantId: "wayz",
      stationId: "stn_wayz_1",
      engineKind: "LAGOON",
      description: "Coach party of 40, paid by transfer on the day the terminal was down.",
      ...gross(3600),
      method: "CARD",
      occurredAt: new Date(Date.now() - 3 * 86_400_000),
      status: "PENDING",
      enteredBy: "usr_acct_wayz",
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: "",
    },
    {
      _id: "man-0002",
      ref: "MAN-0002",
      tenantId: "wayz",
      stationId: "stn_wayz_1",
      engineKind: "MOBILITY",
      description: "Paper receipts from the opening weekend, before the tills were live.",
      ...gross(1250),
      method: "CASH",
      occurredAt: new Date(Date.now() - 21 * 86_400_000),
      status: "APPROVED",
      enteredBy: "usr_acct_wayz",
      reviewedBy: "usr_admin_wayz",
      reviewedAt: new Date(Date.now() - 19 * 86_400_000),
      reviewNote: "Matched against the 12 March bank deposit.",
    },
  ]));
}

async function ensureDemoUsers() {
  const users = onlySeeded(demoUsers());
  const existing = await User.countDocuments({
    _id: { $in: users.map((u) => u._id) },
  });
  if (existing === users.length) return;
  await User.bulkWrite(
    users.map((u) => ({
      updateOne: {
        filter: { _id: u._id },
        update: { $setOnInsert: u },
        upsert: true,
      },
    })),
  );
  logger.info("Demo users reconciled", { added: users.length - existing });
}

const VAT_RATE = 0.15;

function splitInclusive(total: number) {
  const base = Math.round((total / (1 + VAT_RATE)) * 100) / 100;
  return { base, vat: Math.round((total - base) * 100) / 100, total: Math.round(total * 100) / 100 };
}

async function seedFinancialHistory() {
  const activities: { engineKind: EngineKind; product: string; label: string; daily: number; spread: number }[] = [
    { engineKind: "LAGOON", product: "Lagoon boat ride", label: "لاجون", daily: 9, spread: 1400 },
    { engineKind: "MOBILITY", product: "Scooter rental", label: "اسكوترات", daily: 7, spread: 700 },
    { engineKind: "SHOP_AND_DROP", product: "Shop & Drop storage", label: "شوب & دروب", daily: 6, spread: 220 },
  ];

  const payments: Record<string, unknown>[] = [];
  const movements: Record<string, unknown>[] = [];

  let paySeq = 100;
  let movSeq = 100;
  let rng = 20260401;
  const next = () => {
    rng = (rng * 1103515245 + 12345) % 2147483648;
    return rng / 2147483648;
  };

  const HISTORY_ENDS_AT = Date.now() - 5 * MIN;

  for (let dayBack = 89; dayBack >= 0; dayBack--) {
    const day = new Date(Date.now() - dayBack * 86400000);
    day.setHours(11, 0, 0, 0);

    for (const a of activities) {
      const count = Math.max(1, Math.round(a.daily * (0.6 + next() * 0.8)));
      for (let i = 0; i < count; i++) {
        const at = new Date(Math.min(day.getTime() + i * 7 * MIN, HISTORY_ENDS_AT - (count - i) * MIN));
        const gross = Math.round((40 + next() * a.spread) * 100) / 100;
        const tax = splitInclusive(gross);
        const method = next() > 0.42 ? "CARD" : "CASH";
        const cardScheme = method === "CARD" ? pickScheme(next()).scheme : null;
        const historyOrderId = `ord-h${String(paySeq).padStart(5, "0")}`;
        payments.push({
          _id: `pay-${String(paySeq++).padStart(5, "0")}`,
          tenantId: "wayz",
          stationId: "stn_wayz_1",
          kioskId: "ksk_wayz_morocco",
          orderId: historyOrderId,
          bookingId: null,
          amount: tax.total,
          baseAmount: tax.base,
          vatAmount: tax.vat,
          vatRate: VAT_RATE,
          engineKind: a.engineKind,
          method,
          cardScheme,
          kind: "SALE",
          status: "CAPTURED",
          takenBy: "usr_agent_till_wayz",
          shiftId: null,
          createdAt: at,
          updatedAt: at,
        });

        if (next() > 0.94) {
          const refundGross = Math.round(gross * (0.3 + next() * 0.4) * 100) / 100;
          const rtax = splitInclusive(refundGross);
          const rAt = new Date(Math.min(at.getTime() + 45 * MIN, HISTORY_ENDS_AT));
          payments.push({
            _id: `pay-${String(paySeq++).padStart(5, "0")}`,
            tenantId: "wayz",
            stationId: "stn_wayz_1",
            orderId: historyOrderId,
            bookingId: null,
            amount: rtax.total,
            baseAmount: rtax.base,
            vatAmount: rtax.vat,
            vatRate: VAT_RATE,
            engineKind: a.engineKind,
            method,
            cardScheme,
            kind: "REFUND",
            status: "CAPTURED",
            takenBy: "usr_agent_till_wayz",
            shiftId: null,
            createdAt: rAt,
            updatedAt: rAt,
          });
        }
      }
    }

    if (dayBack % 3 === 0) {
      const expenseGross = Math.round((300 + next() * 2600) * 100) / 100;
      const etax = splitInclusive(expenseGross);
      const eAt = new Date(Math.min(day.getTime() + 6 * HOUR, HISTORY_ENDS_AT));
      movements.push({
        _id: `cm-${String(movSeq++).padStart(5, "0")}`,
        tenantId: "wayz",
        stationId: "stn_wayz_1",
        shiftId: "shift_wayz_history",
        actorId: "usr_agent_till_wayz",
        kind: "PAY_OUT",
        amount: etax.total,
        baseAmount: etax.base,
        vatAmount: etax.vat,
        vatRate: VAT_RATE,
        reason: ["Operating supplies", "Equipment maintenance", "POS consumables", "Bank charges"][movSeq % 4],
        reference: `INV-${100000 + movSeq}`,
        createdAt: eAt,
        updatedAt: eAt,
      });
    }
  }

  await Payment.insertMany(payments);
  await CashMovement.insertMany(movements);
  logger.info("Financial history seeded", { payments: payments.length, expenses: movements.length });

  await seedCardTransactions(payments, next);
  await seedAuditTrail(payments, movements);
}

async function seedAuditTrail(
  payments: Record<string, unknown>[],
  movements: Record<string, unknown>[],
) {
  const rows: Record<string, unknown>[] = [];
  const add = (
    at: Date,
    actorId: string,
    action: string,
    entity: string,
    entityId: string,
    detail: string,
    reason?: string,
  ) => rows.push({ tenantId: "wayz", actorId, action, entity, entityId, detail, reason, at });

  for (const p of payments) {
    const at = p.createdAt as Date;
    const id = String(p._id);
    const amount = Number(p.amount).toFixed(2);
    const method = String(p.method);
    if (p.kind === "REFUND") {
      add(at, String(p.takenBy), "PAYMENT_REFUNDED", "Payment", id, `${amount} SAR returned by ${method.toLowerCase()}`, "Customer cancelled after paying");
    } else {
      add(at, String(p.takenBy), "PAYMENT_CAPTURED", "Payment", id, `${amount} SAR taken by ${method.toLowerCase()}`);
    }
  }

  for (const m of movements) {
    add(m.createdAt as Date, String(m.actorId), "DRAWER_PAY_OUT", "CashMovement", String(m._id), `${Number(m.amount).toFixed(2)} SAR — ${String(m.reason)}`);
  }

  const bookings = await Booking.find({ tenantId: "wayz" }).lean();
  for (const b of bookings) {
    add(b.createdAt as Date, b.agentId ?? "usr_agent_wayz", "BOOKING_CREATED", "Booking", b._id, `${b.ref} · ${b.engineKind}`);
    if (b.status === "ACTIVE" || b.status === "OVERTIME") {
      add(new Date(new Date(b.createdAt as Date).getTime() + 4 * MIN), b.agentId ?? "usr_agent_wayz", "BOOKING_STORED", "Booking", b._id, `${b.ref} handed over`);
    }
  }

  const deliveries = await DeliveryRequest.find({ tenantId: "wayz" }).lean();
  for (const d of deliveries) {
    add(d.createdAt as Date, d.requestedBy ?? "usr_agent_wayz", "DELIVERY_REQUESTED", "Delivery", d._id, `to ${String(d.destination?.address ?? "").slice(0, 40)}`);
  }

  const setup = new Date(Date.now() - 90 * 86400000);
  for (const u of onlySeeded(demoUsers()).filter((u) => u.tenantId === "wayz")) {
    add(setup, "usr_admin_wayz", "STAFF_INVITED", "User", u._id, `${u.role} · invitation emailed`);
  }
  add(setup, "usr_admin_wayz", "COMPANY_UPDATED", "Tenant", "wayz", "VAT rate and legal identity confirmed");
  add(new Date(Date.now() - 60 * 86400000), "usr_acct_wayz", "COMMISSION_RATES_UPDATED", "CommissionRate", "wayz", "Contract rates loaded from the acquiring bank");
  add(new Date(Date.now() - 45 * 86400000), "usr_hr_wayz", "SEASON_PAYROLL_CHARGED", "Season", "ssn-0001", "Riyadh Season 2026 — H1 · 6 months charged");

  rows.sort((a, b) => (a.at as Date).getTime() - (b.at as Date).getTime());
  await Audit.insertMany(rows);
  logger.info("Audit trail seeded", { entries: rows.length });
}

const SCHEME_MIX: { scheme: CardScheme; weight: number; bin: string }[] = [
  { scheme: "MADA", weight: 0.5, bin: "5588" },
  { scheme: "SPAN", weight: 0.12, bin: "4176" },
  { scheme: "VISA", weight: 0.16, bin: "4539" },
  { scheme: "MASTERCARD", weight: 0.16, bin: "5412" },
  { scheme: "GCC", weight: 0.06, bin: "6060" },
];

function pickScheme(roll: number): { scheme: CardScheme; bin: string } {
  let acc = 0;
  for (const entry of SCHEME_MIX) {
    acc += entry.weight;
    if (roll <= acc) return { scheme: entry.scheme, bin: entry.bin };
  }
  return { scheme: "MADA", bin: "5588" };
}

async function seedCardTransactions(payments: Record<string, unknown>[], next: () => number) {
  const transactions: Record<string, unknown>[] = [];
  const commissionByDay = new Map<string, { day: string; scheme: CardScheme; amount: number; count: number }>();

  let seq = 1000;
  const record = (
    externalRef: string,
    scheme: CardScheme,
    bin: string,
    gross: number,
    at: Date,
    paymentId: string | null,
    engineKind: EngineKind | null,
    source: string,
  ) => {
    const rate = DEFAULT_COMMISSION_RATES[scheme];
    const commissionAmount = Math.round(gross * rate * 100) / 100;
    const tax = splitInclusive(gross);
    const settled = at.getTime() < Date.now() - 2 * 86400000;

    transactions.push({
      _id: `txn-${String(seq++).padStart(5, "0")}`,
      tenantId: "wayz",
      source,
      externalRef,
      terminalId: "TPE-RIYADH-01",
      scheme,
      maskedPan: `${bin}********${String(1000 + Math.floor(next() * 8999)).slice(0, 4)}`,
      authCode: String(100000 + Math.floor(next() * 899999)),
      currency: "SAR",
      grossAmount: gross,
      commissionRate: rate,
      commissionAmount,
      netSettled: Math.round((gross - commissionAmount) * 100) / 100,
      baseAmount: tax.base,
      vatAmount: tax.vat,
      vatRate: VAT_RATE,
      engineKind,
      stationId: "stn_wayz_1",
      paymentId,
      bookingId: null,
      capturedAt: at,
      settlementDate: settled ? new Date(at.getTime() + 2 * 86400000) : null,
      status: settled ? "SETTLED" : "CAPTURED",
      batchId: "batch-seed",
      createdAt: at,
      updatedAt: at,
    });

    const day = at.toISOString().slice(0, 10);
    const key = `${day}:${scheme}`;
    const bucket = commissionByDay.get(key) ?? { day, scheme, amount: 0, count: 0 };
    bucket.amount = Math.round((bucket.amount + commissionAmount) * 100) / 100;
    bucket.count += 1;
    commissionByDay.set(key, bucket);
  };

  let ref = 700000;
  for (const payment of payments) {
    if (payment.method !== "CARD" || payment.kind !== "SALE") continue;

    const roll = next();
    if (roll < 0.004) continue;

    const recorded = payment.cardScheme as CardScheme;
    const disagrees = roll > 0.988 && roll <= 0.992;
    const scheme = disagrees ? (recorded === "VISA" ? "MASTERCARD" : "VISA") : recorded;
    const bin = SCHEME_MIX.find((m) => m.scheme === scheme)?.bin ?? "5588";
    const at = payment.createdAt as Date;
    const drift = roll > 0.994 ? Math.round((0.5 + next() * 4) * 100) / 100 : 0;
    const gross = Math.round(((payment.amount as number) + drift) * 100) / 100;

    record(
      `RRN${ref++}`,
      scheme,
      bin,
      gross,
      at,
      payment._id as string,
      payment.engineKind as EngineKind,
      next() > 0.5 ? "TPE" : "ETL",
    );
  }

  for (let i = 0; i < 4; i++) {
    const at = new Date(Date.now() - (3 + i * 5) * 86400000);
    at.setHours(19, 30, 0, 0);
    const { scheme, bin } = pickScheme(next());
    record(`RRN${ref++}`, scheme, bin, Math.round((60 + next() * 900) * 100) / 100, at, null, "LAGOON", "TPE");
  }

  for (const { scheme, bin } of SCHEME_MIX) {
    const at = new Date(Date.now() - 6 * 3600000);
    record(`RRN${ref++}`, scheme, bin, Math.round((120 + next() * 400) * 100) / 100, at, null, "MOBILITY", "TPE");
  }

  await CardTransaction.insertMany(transactions);

  const commissionExpenses: Record<string, unknown>[] = [];
  let expSeq = 500;
  for (const [key, bucket] of commissionByDay) {
    const label = SCHEME_LABELS[bucket.scheme].en;
    const at = new Date(`${bucket.day}T12:00:00.000Z`);
    commissionExpenses.push({
      _id: `exp-${String(expSeq++).padStart(5, "0")}`,
      tenantId: "wayz",
      category: "BANK_COMMISSION",
      description: `Bank commission withheld on ${label} · ${bucket.count} transaction${bucket.count === 1 ? "" : "s"}`,
      supplier: "Acquiring bank",
      reference: `comm:${key}`,
      engineKind: null,
      seasonId: null,
      amount: bucket.amount,
      baseAmount: bucket.amount,
      vatAmount: 0,
      vatRate: 0,
      incurredAt: at,
      status: "RECORDED",
      enteredBy: "system",
      createdAt: at,
      updatedAt: at,
    });
  }
  await Expense.insertMany(commissionExpenses);

  logger.info("Card transactions seeded", {
    transactions: transactions.length,
    commissionRows: commissionExpenses.length,
  });
}

async function seedCostHistory() {
  const addMonths = (from: Date, months: number) => {
    const day = from.getDate();
    const target = new Date(from.getFullYear(), from.getMonth() + months, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(day, lastDay));
    target.setHours(0, 0, 0, 0);
    return target;
  };

  const seasonStart = addMonths(new Date(), -3);
  const seasonEnd = addMonths(seasonStart, 6);

  await Season.insertMany(onlySeeded([
    {
      _id: "ssn-0001",
      tenantId: "wayz",
      name: "Riyadh Season 2026 — H1",
      startsAt: seasonStart,
      endsAt: seasonEnd,
      active: true,
    },
    {
      _id: "ssn-0002",
      tenantId: "wiqar",
      name: "Jeddah Season 2026 — H1",
      startsAt: seasonStart,
      endsAt: seasonEnd,
      active: true,
    },
  ]));

  const operating: {
    category: string;
    description: string;
    supplier: string;
    engineKind: EngineKind | null;
    amount: number;
    daysAgo: number;
  }[] = [
    { category: "RENT_VENUE", description: "Lagoon site rent — quarter", supplier: "Riyadh Season Authority", engineKind: "LAGOON", amount: 172500, daysAgo: 70 },
    { category: "RENT_ACCOMMODATION", description: "Staff accommodation — quarter", supplier: "Al Waha Housing", engineKind: null, amount: 86250, daysAgo: 68 },
    { category: "REPAIR", description: "Boat hull repair after collision", supplier: "Marine Works Co.", engineKind: "LAGOON", amount: 14375, daysAgo: 41 },
    { category: "REPAIR", description: "Scooter battery replacement — 6 units", supplier: "Mobility Parts KSA", engineKind: "MOBILITY", amount: 9200, daysAgo: 33 },
    { category: "MAINTENANCE", description: "Monthly boat servicing", supplier: "Marine Works Co.", engineKind: "LAGOON", amount: 6900, daysAgo: 27 },
    { category: "FUEL_OIL", description: "Fuel and engine oil", supplier: "Petro Supply", engineKind: "LAGOON", amount: 11500, daysAgo: 20 },
    { category: "MAINTENANCE", description: "Locker lock servicing", supplier: "SecureLock", engineKind: "SHOP_AND_DROP", amount: 3450, daysAgo: 16 },
    { category: "SUPPLIER", description: "Barcode label rolls and printer ribbon", supplier: "PrintPro", engineKind: "SHOP_AND_DROP", amount: 2300, daysAgo: 12 },
    { category: "FUEL_OIL", description: "Scooter charging electricity", supplier: "SEC", engineKind: "MOBILITY", amount: 4600, daysAgo: 9 },
    { category: "ADMIN", description: "Season administrative charges", supplier: "", engineKind: null, amount: 23000, daysAgo: 6 },
  ];

  const expenses: Record<string, unknown>[] = [];
  let seq = 300;
  for (const o of operating) {
    const at = new Date(Date.now() - o.daysAgo * 86400000);
    const base = Math.round((o.amount / 1.15) * 100) / 100;
    expenses.push({
      _id: `exp-${String(seq++).padStart(5, "0")}`,
      tenantId: "wayz",
      category: o.category,
      description: o.description,
      supplier: o.supplier,
      reference: `INV-${200000 + seq}`,
      engineKind: o.engineKind,
      seasonId: "ssn-0001",
      amount: o.amount,
      baseAmount: base,
      vatAmount: Math.round((o.amount - base) * 100) / 100,
      vatRate: VAT_RATE,
      incurredAt: at,
      status: "RECORDED",
      enteredBy: "usr_hr_wayz",
      createdAt: at,
      updatedAt: at,
    });
  }

  const payroll: [string, string, number][] = [
    ["usr_agent_wayz", "Omar Al-Wayz — kiosk agent", 5500],
    ["usr_agent_till_wayz", "Reem Al-Sudairi — kiosk agent", 5000],
    ["usr_agent_gate1_wayz", "Majed Al-Subaie — kiosk agent", 5500],
    ["usr_agent_egypt_wayz", "Lina Al-Faraj — kiosk agent", 5500],
    ["usr_welcome_wayz", "Huda Al-Qahtani — welcoming staff", 6000],
    ["usr_captain_wayz", "Saad Al-Balawi — chief captain", 7500],
    ["usr_sup_wayz", "Tariq Al-Anazi — supervisor", 9000],
    ["usr_sup_lagoon_wayz", "Nouf Al-Shammari — supervisor", 9000],
    ["usr_courier_wayz", "Bilal Al-Harbi — delivery agent", 4500],
    ["usr_courier2_wayz", "Khalid Al-Otaibi — delivery agent", 4500],
    ["usr_mgr_wayz", "Faisal Al-Mutairi — activity manager", 14000],
    ["usr_mgr_lagoon_wayz", "Amal Al-Harthy — activity manager", 14000],
  ];
  for (const [userId, label, monthly] of payroll) {
    const total = monthly * 6;
    expenses.push({
      _id: `exp-${String(seq++).padStart(5, "0")}`,
      tenantId: "wayz",
      category: "PAYROLL",
      description: `${label} · Riyadh Season 2026 — H1`,
      supplier: "",
      reference: userId,
      engineKind: null,
      seasonId: "ssn-0001",
      amount: total,
      baseAmount: total,
      vatAmount: 0,
      vatRate: 0,
      incurredAt: seasonStart,
      status: "RECORDED",
      enteredBy: "usr_hr_wayz",
      createdAt: seasonStart,
      updatedAt: seasonStart,
    });
  }

  await Expense.insertMany(expenses);
  logger.info("Cost history seeded", { expenses: expenses.length });
}

export async function seedIfEmpty() {
  const count = await Tenant.estimatedDocumentCount();
  if (count === 0) {
    await seedFresh();
    return;
  }
  logger.info("Seed skipped — data already present", { tenants: count });
  await ensureDemoUsers();
}
