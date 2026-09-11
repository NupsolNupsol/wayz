import { connectDB, disconnectDB } from '../config/db.js'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { bootstrapPlatform } from './bootstrap.js'
import { closeAllConnections, platformDb } from './connections.js'
import { createTenant, provisionTenant } from './provisioning.service.js'
import { runInTenant } from './tenantContext.js'
import { hashPassword } from '../models/user.model.js'
import type { TenantRegistryDoc } from './registry.model.js'

/**
 * Provisions the tenant the isolation tests attack WAYZ from.
 *
 * It goes through the real provisioning service rather than writing fixtures, so what the
 * isolation test proves is a property of genuinely provisioned tenants — not of data that
 * happened to be arranged conveniently.
 *
 * Re-running is safe: an existing tenant is resumed rather than duplicated, which is also
 * a small live check that provisioning is idempotent.
 */
async function run() {
  const slug = process.env.ISOLATION_TENANT_SLUG ?? 'isolation'
  const admin = {
    email: process.env.ISOLATION_TENANT_EMAIL ?? 'admin.isolation@lockerflow.test',
    fullName: 'Isolation Probe Admin',
    password: process.env.ISOLATION_TENANT_PASSWORD ?? 'Isolation@12345',
  }

  await connectDB(env.MONGODB_URI)
  await bootstrapPlatform()

  const { TenantRegistry } = platformDb()
  const existing = await TenantRegistry.findById(slug).lean<TenantRegistryDoc>()

  const tenant = existing
    ? await provisionTenant(slug, admin)
    : await createTenant({
        slug,
        name: 'Isolation Probe',
        admin,
        createdBy: 'test-harness',
        invoice: { legalName: 'Isolation Probe Ltd', tradingName: 'Isolation' },
        branding: { primaryColor: '#7c3aed', secondaryColor: '#4c1d95', logoText: 'IP' },
        capabilities: [],
        enabledProfiles: [],
      })

  /*
   * A working agent, so the isolation test can actually try to reach across.
   *
   * Provisioning deliberately does not invent staff for a tenant, so this belongs to the
   * test harness rather than to the platform: the attack the test performs has to be made
   * by somebody with enough permission to do real work in their own tenant, or a refusal
   * proves nothing about isolation.
   */
  await runInTenant(tenant._id, async (ctx) => {
    const { User } = ctx.models
    const email = process.env.ISOLATION_AGENT_EMAIL ?? 'agent.isolation@lockerflow.test'
    const already = await User.findOne({ email }).lean()
    if (!already) {
      await User.create({
        _id: `usr_agent_${ctx.slug}`,
        tenantId: ctx.tenantId,
        email,
        fullName: 'Isolation Probe Agent',
        passwordHash: await hashPassword(process.env.ISOLATION_AGENT_PASSWORD ?? 'Isolation@12345'),
        role: 'AGENT',
        engineKinds: [],
        stationId: '',
        kioskId: null,
        active: true,
      })
    }
  })

  logger.info(existing ? 'Isolation tenant resumed' : 'Isolation tenant created', {
    tenant: tenant._id,
    db: tenant.dbName,
    lifecycle: tenant.lifecycle,
  })

  await closeAllConnections()
  await disconnectDB()
  process.exit(0)
}

run().catch((err) => {
  logger.error('Could not provision the isolation tenant', { err: err instanceof Error ? err.message : String(err) })
  process.exit(1)
})
