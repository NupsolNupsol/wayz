import { Schema } from 'mongoose';

/**
 * Somebody who runs the platform, as opposed to somebody who works at one of its companies.
 *
 * ## Why this is not a `Role`
 *
 * Every other person in the product is a `User` with a `Role`, and a `Role` means *a job
 * inside one organisation* — it decides which counter you stand at, what you are paid, which
 * activities you may staff, what your sidebar shows. The product is full of
 * `Record<Role, …>` tables that all assume exactly that.
 *
 * A platform administrator has none of those properties. They do not work at a station, they
 * have no salary band, they staff no activity, and above all they do not belong to an
 * organisation — they are the person who *creates* organisations. Adding `SUPER_ADMIN` to the
 * role enum would force a meaningless entry into every one of those tables and would quietly
 * break the one invariant the scoping layer rests on: that a signed-in caller has an
 * organisation.
 *
 * So they are a separate identity with a separate token kind. `authenticate` refuses their
 * token, `authenticatePlatform` refuses everybody else's, and nothing in between has to think
 * about it.
 *
 * ## They are never advertised
 *
 * The sign-in page publishes demonstration accounts for each organisation. This collection is
 * deliberately not part of that: it reads `User`, and a platform administrator is not one.
 * Their credential comes from the environment at boot and is never written into source, a
 * seed, or an API response.
 */

export interface PlatformAdminDoc {
  _id: string;
  email: string;
  fullName: string;
  passwordHash: string;
  active: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const PlatformAdminSchema = new Schema<PlatformAdminDoc>(
  {
    _id: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    fullName: { type: String, required: true },
    passwordHash: { type: String, required: true },
    active: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: null },
  },
  { _id: false, timestamps: true }
);
