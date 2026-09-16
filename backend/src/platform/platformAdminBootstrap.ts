import bcrypt from 'bcryptjs'

import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { PlatformAdmin } from '../models/index.js'

/**
 * Makes sure the deployment has somebody who can run it.
 *
 * ## Why this reads the environment and not a seed
 *
 * A platform administrator can create companies and read every company's figures. A credential
 * with that reach must not exist in source control, in a seed file, or in a demonstration list
 * — anybody who can read the repository would have it, on every deployment that ever ran the
 * seed, forever.
 *
 * So it comes from the environment of the machine it runs on, and that is the only way it can
 * be created. A deployment that sets nothing simply has no platform administrator: the console
 * is unreachable, every other part of the product works, and the log says why.
 *
 * ## What it does on each boot
 *
 * Creates the account if it is missing. If it exists, it leaves the password alone unless the
 * configured one no longer matches — which is what makes rotation a matter of changing the
 * environment variable and restarting, without a migration or a console of its own.
 */
export async function ensurePlatformAdmin(): Promise<void> {
  const email = env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase()
  const password = env.PLATFORM_ADMIN_PASSWORD

  if (!email || !password) {
    logger.info('No platform administrator configured', {
      hint: 'Set PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD to enable the platform console.',
    })
    return
  }

  const existing = await PlatformAdmin.findOne({ email })

  if (!existing) {
    await PlatformAdmin.create({
      _id: `padm_${email.replace(/[^a-z0-9]+/g, '_').slice(0, 40)}`,
      email,
      fullName: env.PLATFORM_ADMIN_NAME,
      passwordHash: await bcrypt.hash(password, 10),
      active: true,
    })
    /* The address, never the credential. */
    logger.info('Platform administrator created', { email })
    return
  }

  const unchanged = await bcrypt.compare(password, existing.passwordHash)
  if (!unchanged) {
    existing.passwordHash = await bcrypt.hash(password, 10)
    existing.fullName = env.PLATFORM_ADMIN_NAME
    existing.active = true
    await existing.save()
    logger.info('Platform administrator credential rotated from the environment', { email })
    return
  }

  if (existing.active === false) {
    existing.active = true
    await existing.save()
    logger.info('Platform administrator re-enabled', { email })
  }
}
