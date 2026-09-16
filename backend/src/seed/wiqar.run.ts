import { logger } from '../config/logger.js'
import { bootstrapApp } from '../platform/bootstrap.js'
import { closeAllConnections } from '../platform/connections.js'
import { runInOrg } from '../platform/orgScope.js'
import { seedWiqar } from './wiqar.seed.js'

/**
 * Seeds WIQAR into the shared database.
 *
 * Runs inside WIQAR's own organisation scope, so every row it writes is stamped with it and
 * nothing it reads can see another organisation's records. WAYZ is untouched — the two share a
 * database and nothing else.
 */
async function run() {
  await bootstrapApp()

  const report = await runInOrg('wiqar', () => seedWiqar())

  console.log('')
  console.log('WIQAR · Ana\'am Experience')
  console.log('='.repeat(64))
  console.log(`  locations        ${report.sites}`)
  console.log(`  service areas    ${report.areas}`)
  console.log(`  counters         ${report.counters}`)
  console.log(`  species          ${report.species}`)
  console.log(`  animals          ${report.animals}`)
  console.log(`  retail products  ${report.products}`)
  console.log(`  people           ${report.people}`)
  console.log('')
  console.log('  Sign in at /login — one door for every organisation.')
  console.log('')

  await closeAllConnections()
  process.exit(0)
}

run().catch((err) => {
  logger.error('WIQAR seed failed', { err: err instanceof Error ? err.message : String(err) })
  process.exit(1)
})
