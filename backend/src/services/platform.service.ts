import bcrypt from 'bcryptjs';

import {
  AssetUnit,
  Booking,
  Payment,
  PlatformAdmin,
  Site,
  Station,
  Tenant,
  User,
} from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { runAcrossOrganisations, runInOrg } from '../platform/orgScope.js';
import { listCatalogue } from '../platform/activityCatalogue.js';
import { logger } from '../config/logger.js';
import type { EngineKind } from '../domain/types.js';
import type { BilingualLabel } from '../interfaces/accounting.interface.js';

/**
 * What whoever runs the platform can see and do.
 *
 * ## The one rule this file lives by
 *
 * Every read here is *unscoped by necessity* — the questions are all "across the companies",
 * and there is no organisation to be inside of when you are listing them. That is a real
 * exception to the scoping rule the rest of the product depends on, so it is confined to this
 * file and follows one discipline:
 *
 *   **`runAcrossOrganisations` is used to answer "which organisations exist", and for nothing
 *   else. Every figure about an organisation is then read inside `runInOrg`.**
 *
 * So a report over five companies is five scoped reads and not one broad query. It costs more
 * round trips and buys the thing worth buying: the same scoping that protects a tenant admin's
 * screens is the scoping that produces these numbers, so the two can never disagree, and a bug
 * in the scoping layer shows up here as a wrong total rather than hiding behind a query that
 * deliberately bypassed it.
 *
 * If you add a function to this file, add it that way. A single aggregate across every
 * organisation would be faster and would be the first crack in the wall.
 */

/* ------------------------------------------------------------------ signing in */

/**
 * Finds a platform administrator by address.
 *
 * `PlatformAdmin` is exempt from organisation scoping (see `sharedModels.ts`), so this needs
 * no `runAcrossOrganisations` — there is no organisation filter to escape.
 */
export async function platformAdminByEmail(email: string) {
  return PlatformAdmin.findOne({ email: email.trim().toLowerCase(), active: true }).lean();
}

export async function verifyPlatformAdmin(email: string, password: string) {
  const admin = await platformAdminByEmail(email);
  if (!admin) return null;
  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) return null;

  await PlatformAdmin.updateOne({ _id: admin._id }, { $set: { lastSeenAt: new Date() } });
  return admin;
}

/* ------------------------------------------------------------------ the organisations */

export interface OrganisationSummary {
  id: string;
  name: string;
  branding: Record<string, unknown>;
  activities: EngineKind[];
  createdAt: Date | null;
  staff: number;
  sites: number;
}

/** Every organisation, with the few numbers a console lists them by. */
export async function listOrganisations(): Promise<OrganisationSummary[]> {
  /* The list itself — the one question that cannot be asked from inside an organisation. */
  const companies = await runAcrossOrganisations(() =>
    Tenant.find({}, { name: 1, branding: 1, enabledEngines: 1, createdAt: 1 })
      .sort({ name: 1 })
      .lean()
  );

  /* Everything else, one organisation at a time, through the ordinary scoped path. */
  return Promise.all(
    companies.map(async (company) =>
      runInOrg(company._id, async () => ({
        id: company._id,
        name: company.name,
        branding: (company.branding ?? {}) as Record<string, unknown>,
        activities: (company.enabledEngines ?? []) as EngineKind[],
        createdAt: company.createdAt ?? null,
        staff: await User.countDocuments({ active: true }),
        sites: await Site.countDocuments({}),
      }))
    )
  );
}

/* ------------------------------------------------------------------ creating one */

export interface CreateOrganisationInput {
  id: string;
  name: string;
  activities: EngineKind[];
  branding?: Record<string, string>;
  /**
   * Registration details, when they are known.
   *
   * Optional, because a company is usually set up before its commercial registration and VAT
   * number arrive. An invoice cannot be issued until they are filled in — see
   * `invoice.service.ts`, which refuses by name rather than printing a blank.
   */
  registration?: { legalName?: string; crNumber?: string; vatNumber?: string };
  admin: { fullName: string; email: string; password: string };
}

/**
 * The identifier an organisation is known by, everywhere.
 *
 * It ends up in `tenantId` on every row that organisation will ever own, so it is narrowed
 * hard: lowercase letters, digits and hyphens. That is not a security boundary — one shared
 * database means nothing here selects a database name — it is so the value stays safe to put
 * in a URL, a filename and a log line without escaping, for the rest of its life.
 */
const ID_SHAPE = /^[a-z][a-z0-9-]{1,38}[a-z0-9]$/;

/**
 * Creates an organisation and its first administrator.
 *
 * Deliberately *not* a provisioning pipeline. Under the shared database there is nothing to
 * provision — no database to create, no indexes to build, no catalogue to copy — so this is
 * two documents written inside the new organisation's own scope, and the console's job is to
 * adopt activities and invite people afterwards.
 *
 * The first administrator's password is chosen by the caller and stored hashed. It is never
 * returned, logged, or written anywhere else.
 */
export async function createOrganisation(input: CreateOrganisationInput) {
  const id = input.id.trim().toLowerCase();

  if (!ID_SHAPE.test(id)) {
    throw ApiError.badRequest(
      'An organisation identifier is lowercase letters, digits and hyphens, and starts with a letter.',
      ['For example: "wiqar", "north-coast", "atlas-leisure".']
    );
  }

  const existing = await runAcrossOrganisations(() => Tenant.findById(id).lean());
  if (existing) throw ApiError.conflict(`There is already an organisation called "${id}".`);

  const email = input.admin.email.trim().toLowerCase();

  /*
   * An address has to be unique across the whole platform, not just inside the new company.
   *
   * Sign-in is one neutral door and the account decides which organisation it opens, so two
   * people at different companies sharing an address would make that decision ambiguous.
   */
  const taken = await runAcrossOrganisations(() => User.findOne({ email }, { tenantId: 1 }).lean());
  if (taken) {
    throw ApiError.conflict(`${email} already belongs to somebody at "${taken.tenantId}".`);
  }

  const catalogue = listCatalogue().map((a) => a.key);
  const unknown = input.activities.filter((a) => !catalogue.includes(a));
  if (unknown.length > 0) {
    throw ApiError.badRequest(`The platform has no activity called ${unknown.join(', ')}.`, [
      `Registered activities: ${catalogue.join(', ')}.`,
    ]);
  }

  const passwordHash = await bcrypt.hash(input.admin.password, 10);

  /*
   * Written from inside the new organisation, so the scoping layer stamps `tenantId` exactly
   * as it does for every other write. Nothing here sets it by hand.
   */
  const created = await runInOrg(id, async () => {
    await Tenant.create({
      _id: id,
      name: input.name.trim(),
      legalName: input.registration?.legalName?.trim() ?? '',
      crNumber: input.registration?.crNumber?.trim() ?? '',
      vatNumber: input.registration?.vatNumber?.trim() ?? '',
      enabledEngines: input.activities,
      /* Only what was given; the schema fills the rest with the house palette. */
      ...(input.branding ? { branding: input.branding } : {}),
    });

    await User.create({
      _id: `usr_${id}_admin`,
      tenantId: id,
      fullName: input.admin.fullName.trim(),
      email,
      passwordHash,
      role: 'TENANT_ADMIN',
      active: true,
      setUp: true,
      engineKinds: input.activities,
    });

    return Tenant.findById(id).lean();
  });

  logger.info('Organisation created', { organisation: id, activities: input.activities.length });
  return created;
}

/** Changes what an organisation has adopted, or how it looks. */
export async function updateOrganisation(
  id: string,
  patch: { name?: string; activities?: EngineKind[]; branding?: Record<string, string> }
) {
  const catalogue = listCatalogue().map((a) => a.key);

  return runInOrg(id, async () => {
    const company = await Tenant.findById(id);
    if (!company) throw ApiError.notFound('No such organisation.');

    if (patch.name) company.name = patch.name.trim();

    if (patch.activities) {
      const unknown = patch.activities.filter((a) => !catalogue.includes(a));
      if (unknown.length > 0)
        throw ApiError.badRequest(`The platform has no activity called ${unknown.join(', ')}.`);
      company.enabledEngines = patch.activities;
      company.markModified('enabledEngines');
    }

    if (patch.branding) {
      company.branding = { ...(company.branding ?? {}), ...patch.branding };
      company.markModified('branding');
    }

    await company.save();
    return company.toObject();
  });
}

/* ------------------------------------------------------------------ reports and analytics */

export interface OrganisationFigures {
  id: string;
  name: string;
  staff: number;
  sites: number;
  stations: number;
  resources: number;
  activities: EngineKind[];
  bookings: number;
  revenue: number;
  byActivity: { kind: EngineKind; bookings: number; revenue: number }[];
}

/**
 * The figures behind one organisation, for a window.
 *
 * Read inside that organisation, so these are the same numbers its own reporting screens show.
 * A platform report that disagreed with the tenant's own would be worse than no report.
 */
async function figuresFor(
  company: { _id: string; name: string; enabledEngines?: string[] },
  from: Date,
  to: Date
) {
  return runInOrg(company._id, async (): Promise<OrganisationFigures> => {
    const window = { createdAt: { $gte: from, $lte: to } };

    const [staff, sites, stations, resources, bookings, paid] = await Promise.all([
      User.countDocuments({ active: true }),
      Site.countDocuments({}),
      Station.countDocuments({}),
      AssetUnit.countDocuments({}),
      Booking.countDocuments(window),
      Payment.aggregate<{ _id: null; total: number }>([
        { $match: { ...window, status: 'PAID' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    /*
     * Per activity, from bookings rather than from the adopted list — an activity adopted last
     * week and not yet sold should read zero, not be missing.
     */
    const grouped = await Booking.aggregate<{ _id: EngineKind; bookings: number; revenue: number }>(
      [
        { $match: window },
        { $group: { _id: '$engineKind', bookings: { $sum: 1 }, revenue: { $sum: '$total' } } },
      ]
    );
    const soldBy = new Map(grouped.map((g) => [g._id, g]));

    const adopted = (company.enabledEngines ?? []) as EngineKind[];
    const byActivity = adopted.map((kind) => ({
      kind,
      bookings: soldBy.get(kind)?.bookings ?? 0,
      revenue: Math.round((soldBy.get(kind)?.revenue ?? 0) * 100) / 100,
    }));

    return {
      id: company._id,
      name: company.name,
      staff,
      sites,
      stations,
      resources,
      activities: adopted,
      bookings,
      revenue: Math.round((paid[0]?.total ?? 0) * 100) / 100,
      byActivity,
    };
  });
}

export interface PlatformReport {
  from: string;
  to: string;
  totals: {
    organisations: number;
    staff: number;
    sites: number;
    bookings: number;
    revenue: number;
  };
  organisations: OrganisationFigures[];
  /** Adoption across the platform: how many companies run each registered activity. */
  adoption: {
    kind: EngineKind;
    label: BilingualLabel;
    organisations: number;
    bookings: number;
    revenue: number;
  }[];
}

export async function platformReport(from: Date, to: Date): Promise<PlatformReport> {
  const companies = await runAcrossOrganisations(() =>
    Tenant.find({}, { name: 1, enabledEngines: 1 }).sort({ name: 1 }).lean()
  );

  const organisations = await Promise.all(companies.map((c) => figuresFor(c, from, to)));

  const adoption = listCatalogue().map((activity) => {
    const running = organisations.filter((o) => o.activities.includes(activity.key));
    const lines = running.flatMap((o) => o.byActivity.filter((a) => a.kind === activity.key));
    return {
      kind: activity.key,
      label: activity.label,
      organisations: running.length,
      bookings: lines.reduce((n, l) => n + l.bookings, 0),
      revenue: Math.round(lines.reduce((n, l) => n + l.revenue, 0) * 100) / 100,
    };
  });

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    totals: {
      organisations: organisations.length,
      staff: organisations.reduce((n, o) => n + o.staff, 0),
      sites: organisations.reduce((n, o) => n + o.sites, 0),
      bookings: organisations.reduce((n, o) => n + o.bookings, 0),
      revenue: Math.round(organisations.reduce((n, o) => n + o.revenue, 0) * 100) / 100,
    },
    organisations,
    adoption,
  };
}
