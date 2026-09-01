import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5175'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/lockerflow'),
  // No default on purpose: a signing key checked into the repository is a signing key
  // every reader of the repository can forge tokens with. Boot fails loudly instead.
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
  VONAGE_MESSAGES_URL: z.string().default('https://messages-sandbox.nexmo.com/v1/messages'),

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

  EXPIRY_WARNING_MINUTES: z.coerce.number().int().positive().default(15),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
   
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
export type Env = typeof env
