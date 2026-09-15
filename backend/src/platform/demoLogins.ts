import bcrypt from 'bcryptjs'

import { ROLE_LABELS } from '../constants/labels.constants.js'
import type { Role } from '../domain/types.js'

/**
 * The demo accounts a tenant's sign-in screen may advertise.
 *
 * The rule this file exists to enforce is narrow and absolute: **the screen must never show a
 * credential that does not work.** Everything below follows from that.
 *
 * The previous version guessed a password from the person's job — TENANT_ADMIN meant
 * `Admin@123`, and so on. That was true for the one tenant the table had been written against
 * and a lie for every tenant provisioned afterwards, each of which chose its own administrator
 * password at creation. The screen confidently published a credential no database held, and
 * signing in with it failed.
 *
 * So nothing is guessed here any more. Two things happen instead:
 *
 *   1. **Whoever creates a demo account records what it created** — the seed for the accounts
 *      it seeds, provisioning for a tenant's first administrator — in `demoCredential`.
 *   2. **Nothing is published until it is verified.** Every candidate is checked against the
 *      stored hash with bcrypt before it reaches the response. A record that has drifted from
 *      the hash (a password changed since, a half-finished reseed) fails the check and is
 *      simply not offered.
 *
 * Recording alone would be a single source of truth but could still go stale. Verifying alone
 * cannot tell you the password. Together they make the advertised list provably correct.
 *
 * A real deployment sets `DEMO_LOGINS=false`: nothing is written, nothing is read, and the
 * list is empty.
 */

/**
 * What each activity is called on a sign-in page.
 *
 * Deliberately short: this appears inside a one-line label beside a job and sometimes a desk,
 * so "Shop & Drop" rather than the fuller name a navigation entry can afford.
 */
const ENGINE_LABELS: Record<string, string> = {
  SHOP_AND_DROP: 'Shop & Drop',
  MOBILITY: 'Mobility',
  LAGOON: 'Lagoon',
  COTE_RESTAURANT: 'Dining',
  ANAAM: 'Animals',
}

/** Seeded demo accounts are the ones on the demo domain; anybody hired since is not listed. */
const DEMO_DOMAIN = '@lockerflow.demo'

export interface DemoLogin {
  label: string
  email: string
  password: string
  role: Role
}

export interface DemoCandidate {
  email: string
  fullName: string
  role: Role
  kioskName?: string | null
  /** The activities this person works. What makes one kiosk agent different from another. */
  engineKinds?: string[] | null
  /**
   * What this person's own company calls their job.
   *
   * Preferred over the platform's base-role label wherever it exists. WIQAR's chief accountant
   * and its purchasing agent are both `ACCOUNTANT` underneath, and listing them both as
   * "Accountant" tells nobody which is which — the base role is a shape, not a job title.
   */
  roleLabel?: string | null
  /** What the creator of this account recorded. Absent for anybody not created as a demo. */
  demoCredential?: string | null
  /** What the database will actually check a sign-in against. */
  passwordHash?: string | null
}

/**
 * The demo accounts a given tenant actually holds, each one proven to work.
 *
 * Read from that tenant's own database, so a company that runs horse tours lists horse-tour
 * jobs and a company that runs a lagoon lists captains — without either tenant's name
 * appearing anywhere in this file.
 */
export async function seededDemoLoginsFor(users: DemoCandidate[]): Promise<DemoLogin[]> {
  const candidates = users.filter(
    (u) => u.email.endsWith(DEMO_DOMAIN) && !!u.demoCredential && !!u.passwordHash,
  )

  const verified = await Promise.all(
    candidates.map(async (u) => {
      /*
       * The check that makes this list honest.
       *
       * bcrypt is deliberately slow, which is the point of it, so this is the one expensive
       * thing on an otherwise cheap public route. It is bounded by the number of seeded demo
       * accounts a tenant has — tens, not thousands — and it only ever runs on a deployment
       * that has declared itself a demonstration.
       */
      const works = await bcrypt.compare(u.demoCredential as string, u.passwordHash as string).catch(() => false)
      return works ? u : null
    }),
  )

  const real = verified.filter((u): u is DemoCandidate => u !== null)

  /*
   * Say the job, then the activity, then the desk — and stop as soon as the row is unambiguous.
   *
   * Naming only the job and the desk made the lagoon staff impossible to find: "Kiosk agent ·
   * Mountain" and "Kiosk agent · Egypt" are the two jetty agents, and nothing on either row
   * said so, so somebody looking for a lagoon login concluded there wasn't one. Two rows even
   * read "Kiosk agent · Iran" identically, because the desk alone does not distinguish an
   * agent who works one activity from one who works all three.
   *
   * The activity is what actually tells these people apart, so it comes first — and the desk
   * is added only where the activity still leaves two rows the same.
   */
  /** What the company calls this job, falling back to the platform's shape for a tenant with none. */
  const jobTitle = (u: DemoCandidate): string => u.roleLabel?.trim() || ROLE_LABELS[u.role] || u.role

  const activityOf = (u: DemoCandidate): string => {
    const engines = [...new Set(u.engineKinds ?? [])]
    if (engines.length === 0) return ''
    if (engines.length > 2) return 'every activity'
    return engines.map((e) => ENGINE_LABELS[e] ?? e).join(' & ')
  }

  const jobAndActivity = (u: DemoCandidate): string => {
    const job = jobTitle(u)
    const activity = activityOf(u)
    return activity ? `${job} · ${activity}` : job
  }

  const shared = new Map<string, number>()
  for (const u of real) {
    const key = jobAndActivity(u)
    shared.set(key, (shared.get(key) ?? 0) + 1)
  }

  return real
    .map((u) => {
      const base = jobAndActivity(u)
      const qualifier = u.kioskName || u.fullName
      const ambiguous = (shared.get(base) ?? 0) > 1

      return {
        label: ambiguous && qualifier ? `${base} · ${qualifier}` : base,
        email: u.email,
        password: u.demoCredential as string,
        role: u.role,
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label))
}
