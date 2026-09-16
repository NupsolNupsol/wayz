import { asyncHandler } from '../utils/asyncHandler.js'
import { env } from '../config/env.js'
import { appDb } from '../platform/connections.js'
import { runAcrossOrganisations } from '../platform/orgScope.js'
import { seededDemoLoginsFor, type DemoCandidate } from '../platform/demoLogins.js'

/**
 * What the sign-in page may show before anybody has signed in.
 *
 * One neutral door for every organisation. It carries no branding, because at this point the
 * product does not know whose employee is standing at it — that is the whole design: a person
 * types their address, the account decides which organisation they belong to, and the colours
 * follow the answer rather than the address.
 *
 * The only thing this endpoint offers is the demonstration accounts, and only on a deployment
 * that has declared itself a demonstration. On any other deployment it returns an empty list:
 * enumerating who works where is not something an unauthenticated caller should be able to do.
 */
/**
 * The advertised list, briefly cached.
 *
 * Every account on this page is verified against its stored hash before it is shown, so that
 * the page can never advertise a credential that does not work. That check is bcrypt at cost
 * ten, and widening the page from one organisation to all of them took it from eighteen
 * comparisons to thirty-one — three to seven seconds per request, on the one endpoint every
 * visitor to the sign-in page hits.
 *
 * Under load it simply timed out and the page rendered with no accounts at all, which looked
 * like a data problem and was a cost problem.
 *
 * The list only changes when somebody is seeded or deactivated, so a short window is enough to
 * make it free without making it stale: a new demonstration account appears within half a
 * minute, and the verification it depends on still happens.
 */
const ADVERTISED_TTL_MS = 30_000
let advertised: { at: number; organisations: unknown[] } | null = null

export const signInController = {
  demoLogins: asyncHandler(async (_req, res) => {
    if (!env.DEMO_LOGINS) {
      res.json({ success: true, data: { organisations: [] } })
      return
    }

    if (advertised && Date.now() - advertised.at < ADVERTISED_TTL_MS) {
      res.json({ success: true, data: { organisations: advertised.organisations } })
      return
    }

    /*
     * Read across organisations, deliberately.
     *
     * This is the sign-in page: there is no organisation in context yet, and the point of the
     * list is to show every organisation's demonstration accounts side by side so a tester can
     * move between them without knowing an address.
     */
    const organisations = await runAcrossOrganisations(async () => {
      const { Tenant, User } = appDb()

      const [companies, people] = await Promise.all([
        Tenant.find({}, { name: 1, branding: 1, enabledEngines: 1 }).lean<
          { _id: string; name: string; branding?: Record<string, unknown>; enabledEngines?: string[] }[]
        >(),
        User.find(
          { active: true },
          { email: 1, fullName: 1, role: 1, tenantId: 1, kioskId: 1, engineKinds: 1, demoCredential: 1, passwordHash: 1 },
        ).lean<(DemoCandidate & { tenantId: string })[]>(),
      ])

      const byOrganisation = new Map<string, (DemoCandidate & { tenantId: string })[]>()
      for (const person of people) {
        byOrganisation.set(person.tenantId, [...(byOrganisation.get(person.tenantId) ?? []), person])
      }

      return Promise.all(
        companies.map(async (company) => ({
          id: company._id,
          name: company.name,
          branding: company.branding ?? {},
          activities: company.enabledEngines ?? [],
          logins: await seededDemoLoginsFor(byOrganisation.get(company._id) ?? []),
        })),
      )
    })

    // A company with no advertisable account is noise on a sign-in page.
    const listed = organisations.filter((o) => o.logins.length > 0)
    advertised = { at: Date.now(), organisations: listed }
    res.json({ success: true, data: { organisations: listed } })
  }),
}
