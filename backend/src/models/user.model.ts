import { Schema } from 'mongoose'
import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'node:crypto'
import type { EngineKind, Role } from '../domain/types.js'

export const INVITE_TTL_HOURS = 72

export interface UserInvite {
  tokenHash: string
  expiresAt: Date
  sentAt: Date
  invitedBy: string
  deliveredTo: string
}

export interface UserDoc {
  _id: string
  email: string
  passwordHash: string | null
  invite: UserInvite | null
  fullName: string
  role: Role
  tenantId: string
  siteId: string
  zoneId: string | null
  stationId: string
  kioskId: string | null
  /**
   * The gate this member of staff covers.
   *
   * Retrieval happens where the lockers are, not where the sale was made: a Mobility agent stands
   * at a gate, so they are the one who fetches a customer's bags out of it. Set for the staff who
   * work a gate; null for everyone else.
   */
  gateId: string | null
  engineKinds: EngineKind[]
  reportsTo: string | null
  phone: string
  active: boolean
  removedAt?: Date | null
  lastLoginAt?: Date | null
  comparePassword(candidate: string): Promise<boolean>
}

const inviteSchema = new Schema<UserInvite>(
  {
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    sentAt: { type: Date, required: true },
    invitedBy: { type: String, default: '' },
    deliveredTo: { type: String, default: '' },
  },
  { _id: false },
)

const userSchema = new Schema<UserDoc>(
  {
    _id: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, default: null },
    invite: { type: inviteSchema, default: null },
    fullName: { type: String, required: true },
    role: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    /*
     * Where the person works, when that is a meaningful question.
     *
     * A cashier belongs to a station and a kiosk; a tenant administrator, an accountant or
     * a platform-provisioned owner belongs to the tenant. Requiring a station of everyone
     * was a WAYZ-shaped assumption that made it impossible to create a tenant's first
     * administrator before the tenant had any stations to put them in.
     */
    siteId: { type: String, default: '' },
    zoneId: { type: String, default: null },
    stationId: { type: String, default: '', index: true },
    kioskId: { type: String, default: null, index: true },
    gateId: { type: String, default: null, index: true },
    engineKinds: { type: [String], default: [], index: true },
    reportsTo: { type: String, default: null, index: true },
    phone: { type: String, default: '' },
    active: { type: Boolean, default: true },
    removedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { _id: false, timestamps: true },
)

userSchema.index({ 'invite.tokenHash': 1 })

userSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  if (!this.passwordHash) return Promise.resolve(false)
  return bcrypt.compare(candidate, this.passwordHash)
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10)
}

export function newInviteToken(): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(32).toString('base64url')
  return {
    token,
    tokenHash: hashInviteToken(token),
    expiresAt: new Date(Date.now() + INVITE_TTL_HOURS * 3_600_000),
  }
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * A new user has to be able to sign in.
 *
 * Sign-in is the one request with no token to name a tenant, so the platform keeps an
 * email → tenant directory. Hooking the schema rather than the half-dozen places that
 * create users means every path — seeding, invitations, provisioning, and whatever is
 * written next — registers itself without having to remember to.
 *
 * The import is deferred to avoid a cycle: the directory reaches back into this schema.
 */
async function registerForLogin(email: string | undefined): Promise<void> {
  if (!email) return
  try {
    const [{ currentTenant }, { rememberLogin }] = await Promise.all([
      import('../platform/tenantContext.js'),
      import('../platform/loginDirectory.js'),
    ])
    const tenant = currentTenant()
    if (tenant) await rememberLogin(email, tenant.tenantId)
  } catch {
    // The directory is a convenience for signing in without naming a tenant; a failure
    // here must never cost the user record itself.
  }
}

userSchema.post('save', function (doc) {
  void registerForLogin(doc?.email)
})

userSchema.post('insertMany', function (docs: unknown) {
  for (const doc of (docs as { email?: string }[] | undefined) ?? []) void registerForLogin(doc?.email)
})

export const UserSchema = userSchema
