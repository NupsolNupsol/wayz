import { Schema } from 'mongoose'

/**
 * What a member of staff has already been shown.
 *
 * A separate collection rather than four more fields on `User`. The user document is read on
 * every authenticated request and is the record of *who somebody is*; whether they have
 * finished a guided tour is neither, and welding the two together means an onboarding change
 * touches the schema that authentication depends on.
 *
 * It lives in the tenant's own database like everything else about that tenant's staff, so a
 * company's onboarding state is isolated by the same wall as its bookings.
 */

export interface LearningProgressDoc {
  /** The user id. One row per person, so the row is found without an index scan. */
  _id: string
  /**
   * The tour that was assigned, by key.
   *
   * Recorded rather than derived, because a person's role can change: an agent promoted to
   * supervisor has not seen the supervisor tour, and "completed" should not follow them into
   * a job they have not been shown.
   */
  tourKey: string
  role: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'
  /** The furthest step reached, so a tour resumes where it stopped rather than restarting. */
  stepIndex: number
  completedSteps: string[]
  startedAt: Date | null
  completedAt: Date | null
  /** How many times the person asked for the tour again from the training page. */
  restarts: number
  createdAt: Date
  updatedAt: Date
}

export const LearningProgressSchema = new Schema<LearningProgressDoc>(
  {
    _id: { type: String, required: true },
    tourKey: { type: String, required: true, index: true },
    role: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'],
      default: 'PENDING',
      index: true,
    },
    stepIndex: { type: Number, default: 0 },
    completedSteps: { type: [String], default: [] },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    restarts: { type: Number, default: 0 },
  },
  { _id: false, timestamps: true },
)
