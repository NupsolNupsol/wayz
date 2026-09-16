import { logger } from '../config/logger.js'
import { appDb, connectApp } from './connections.js'
import { runAcrossOrganisations } from './orgScope.js'

/**
 * Bringing the application up.
 *
 * One connection, and a list of the organisations inside it. That is the whole of it now —
 * there is no control plane to connect to, no registry to read, and no per-organisation
 * database to create, because every organisation shares one.
 *
 * What this replaced is worth knowing if you are reading old commits: bootstrap used to
 * connect a control plane, reconcile a tenant registry, create a database per tenant, copy a
 * legacy database into the first of them, and reindex two lookup directories. All of that
 * existed to answer "which database?" before anything could be read, and none of it is needed
 * once the answer is always "this one".
 */

export async function bootstrapApp(): Promise<void> {
  await connectApp()
}

/**
 * Every organisation the application knows about.
 *
 * Read across organisations deliberately — this is the question that *produces* the list, so
 * it cannot be asked from inside one of them. Used by boot-time seeding and by the session
 * sweeps, each of which then runs once per organisation.
 */
export async function organisationIds(): Promise<string[]> {
  const rows = await runAcrossOrganisations(() =>
    appDb().Tenant.find({}, { _id: 1 }).lean<{ _id: string }[]>(),
  )

  const ids = rows.map((r) => r._id)
  logger.info('Organisations loaded', { count: ids.length, organisations: ids })
  return ids
}
