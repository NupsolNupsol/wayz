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
  /**
   * For a seeded or provisioned demonstration account only: the password it was actually
   * given, recorded by whoever created it.
   *
   * This exists so a sign-in screen can never advertise a credential the database does not
   * hold. The old code guessed the password from the person's job, which was true for the
   * tenant the guesses were written for and a lie for every tenant afterwards.
   *
   * Never written unless the deployment has declared itself a demonstration, never selected
   * unless asked for by name, and never returned by any route except the demo-login list,
   * which verifies it against the hash before publishing it.
   */
  demoCredential: string | null
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
  /**
   * The job this person holds, as their own company defines it.
   *
   * `role` above is the platform primitive — the *shape* of the job, which the token carries
   * and route guards check. This is the business meaning: the permissions, the scope and the
   * activities their company decided this job has. Two tenants may both have a job called
   * "Accountant" and mean different things by it, and this is where the difference lives.
   *
   * Null on a tenant that has not defined its jobs yet, in which case the base role's
   * historical reach applies. See `services/authorisation.service.ts`.
   */
  roleKey: string | null
  /**
   * The tenant-defined activities this person works, by key.
   *
   * Separate from `engineKinds` on purpose. Those are the activities the product ships with
   * and their names are compiled in; these are activities a tenant invented for itself, and
   * their keys exist only in that tenant's own database. Merging the two would mean a tenant
   * could name an activity `MOBILITY` and inherit behaviour nobody granted it.
   */
  activityKeys: string[]
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
    demoCredential: { type: String, default: null, select: false },
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
    roleKey: { type: String, default: null, index: true },
    activityKeys: { type: [String], default: [], index: true },
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


export const UserSchema = userSchema
