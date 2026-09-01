import mongoose, { Schema } from 'mongoose'
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
  engineKinds: EngineKind[]
  phone: string
  active: boolean
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
    siteId: { type: String, required: true },
    zoneId: { type: String, default: null },
    stationId: { type: String, required: true, index: true },
    kioskId: { type: String, default: null, index: true },
    engineKinds: { type: [String], default: [], index: true },
    phone: { type: String, default: '' },
    active: { type: Boolean, default: true },
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

export const User = mongoose.model<UserDoc>('User', userSchema)
