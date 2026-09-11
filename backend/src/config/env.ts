import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5175'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/lockerflow'),

  /**
   * The control plane's own database.
   *
   * Super-admin identities and the tenant registry live here and nowhere else. It is
   * deliberately a separate database from every tenant: the plane that decides which
   * database a request may touch must not sit inside one of them.
   */
  PLATFORM_DB_NAME: z.string().default('lockerflow_platform'),

  /** Every tenant database is this prefix plus the tenant's slug. */
  TENANT_DB_PREFIX: z.string().default('lockerflow_t_'),

  /**
   * First super admin, created on boot when the control plane has none.
   *
   * Left unset, no super admin is created and the platform simply reports that it has
   * not been bootstrapped — which is the right default for a shared environment. These
   * are never committed; they come from the deployment environment.
   */
  PLATFORM_ADMIN_EMAIL: z.string().email().optional(),
  PLATFORM_ADMIN_PASSWORD: z.string().min(12).optional(),
  PLATFORM_ADMIN_NAME: z.string().default('Platform Administrator'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be set to at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  QUEUE_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  AUTO_SEED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  VONAGE_API_KEY: z.string().optional(),
  VONAGE_API_SECRET: z.string().optional(),
  VONAGE_WHATSAPP_NUMBER: z.string().optional(),
  /**
   * Where SMS is posted.
   *
   * The Messages *sandbox* carries social channels only — WhatsApp, Viber, Messenger — so
   * SMS has to go to the live Messages API even while WhatsApp is still on the sandbox.
   * They are separate settings because in development they genuinely point at different
   * places, and forcing one URL on both breaks whichever channel loses.
   */
  VONAGE_MESSAGES_URL: z.string().url().default('https://api.nexmo.com/v1/messages'),

  /** Where WhatsApp is posted. The sandbox until a registered business number replaces it. */
  VONAGE_WHATSAPP_URL: z.string().url().default('https://messages-sandbox.nexmo.com/v1/messages'),

  /**
   * What an SMS appears to come from.
   *
   * Unlike WhatsApp, SMS sends from a sender id rather than a number somebody owns, so
   * there is a sensible default and no extra provisioning to do. Some networks reject
   * alphanumeric senders, which is why it is configurable rather than fixed.
   */
  VONAGE_SMS_FROM: z.string().default('WAYZ'),

  /**
   * What this deployment is for.
   *
   * Separate from NODE_ENV on purpose: a staging server runs a production build (NODE_ENV
   * production, minified, real database) while still being a place where a test team needs to get
   * past a confirmation code without a handset. NODE_ENV describes how the code was built; MODE
   * describes who the server is for. Anything that weakens a check keys off this one, and it
   * defaults to `live` so a server nobody configured is never the weak one.
   */
  MODE: z.enum(['dev', 'live']).default('live'),

  /**
   * A confirmation code that always works, for test runs that cannot read a phone.
   *
   * Honoured only when MODE is dev, and only alongside the real code — the genuine one still
   * arrives and still works, so a scripted run and a human at the counter can use the same server.
   * It is a server-side secret: it is never sent to a browser, never written to a response, and
   * never logged. Leave it unset and there is no such code at all, whatever MODE says.
   */
  STATIC_OTP: z
    .string()
    .trim()
    .optional()
    // Blank is how .env says "no standing code", so it has to mean that rather than stop the
    // server. A value that is present but too short to be a code is a different matter: somebody
    // meant to set one and got it wrong, and finding that out at boot beats finding it out when a
    // tester cannot get past the counter.
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || v.length >= 4, {
      message: 'STATIC_OTP must be at least 4 characters, or left blank for none.',
    }),

  OTP_TEST_PEEK: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  INVITE_TEST_PEEK: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  DEMO_SCANNER: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  DEMO_TIME_TRAVEL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  MAIL_HOST: z.string().optional(),
  MAIL_PORT: z.coerce.number().int().positive().default(465),
  MAIL_SECURE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  MAIL_DOMAIN: z.string().optional(),
  SENDER_EMAIL: z.string().optional(),
  SENDER_PASSWORD: z.string().optional(),
  MAIL_FROM_NAME: z.string().default('WAYZ'),

  MAIL_FALLBACK_HOST: z.string().optional(),
  MAIL_FALLBACK_PORT: z.coerce.number().int().positive().default(465),
  MAIL_FALLBACK_SECURE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  MAIL_FALLBACK_USER: z.string().optional(),
  MAIL_FALLBACK_PASSWORD: z.string().optional(),

  PUBLIC_APP_URL: z.string().url().default('http://localhost:5175'),

  PUBLIC_API_URL: z
    .string()
    .transform((v) => v.trim() || undefined)
    .refine((v) => !v || /^https?:\/\/\S+$/.test(v), 'PUBLIC_API_URL must be an http(s) address.')
    .optional(),

  EXPIRY_WARNING_MINUTES: z.coerce.number().int().positive().default(15),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
   
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
export type Env = typeof env
