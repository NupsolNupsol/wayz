import { Schema, model } from 'mongoose'

/**
 * An activity a tenant defined for itself.
 *
 * Until now an activity was a value in an enum — `SHOP_AND_DROP`, `MOBILITY`, `LAGOON` — and
 * adding one meant a developer, a deployment and a release. That is the right shape for a
 * product with one customer and the wrong shape for a platform: WIQAR's horse rides, falconry
 * sessions and desert dinners are not variations on a lagoon, and nobody should have to ship
 * code for tenant number seven to sell what it sells.
 *
 * So an activity is a **record a tenant owns**. Its counter form, its rules and its workflow
 * are configuration, authored by that tenant's administrator and stored in that tenant's own
 * database. Nothing here names a tenant.
 *
 * ## Why revisions exist
 *
 * A booking is a promise about a price and a set of conditions. If editing an activity
 * rewrote the activity that past bookings point at, then changing a rule tomorrow would
 * silently change what a customer bought yesterday — their receipt would stop matching their
 * booking, and an auditor would find figures that no longer add up.
 *
 * So a definition holds a list of **published revisions**, each one frozen. A booking records
 * the revision number it was sold under and always resolves against that. Editing produces a
 * new draft; publishing appends a new revision; nothing already sold moves.
 *
 * ## Why the rules are declarative
 *
 * Every condition below is *data* — a comparison drawn from a fixed vocabulary. None of it is
 * an expression, and nothing evaluates a string. A tenant administrator writing a rule in a
 * form must never be able to make the server run something, and a validator stored as code
 * would be exactly that, however carefully it was sandboxed at first.
 */

/* -------------------------------------------------------------------------------------- */
/* Inputs — what the agent is asked for at the counter                                       */
/* -------------------------------------------------------------------------------------- */

export const ACTIVITY_FIELD_KINDS = [
  'TEXT',
  'NUMBER',
  'SELECT',
  'BOOLEAN',
  'DATE',
  'TIME',
  'PHONE',
  'NATIONAL_ID',
  /** A person from the tenant's own customer book. */
  'CUSTOMER',
  /** One of the tenant's own asset units — a horse, a boat, a scooter. */
  'ASSET_UNIT',
  /** A member of the tenant's own staff — a guide, a captain, a handler. */
  'STAFF',
  'NOTE',
] as const
export type ActivityFieldKind = (typeof ACTIVITY_FIELD_KINDS)[number]

export interface ActivityFieldDoc {
  /** Stable within the activity. Rules and workflow refer to a field by this. */
  key: string
  label: string
  labelAr: string
  kind: ActivityFieldKind
  required: boolean
  helpText: string
  helpTextAr: string
  /** SELECT only. */
  options: { value: string; label: string; labelAr: string }[]
  /** NUMBER only. */
  min: number | null
  max: number | null
  step: number | null
  /** ASSET_UNIT only: which kind of thing may be chosen. */
  assetTypeId: string | null
  /** Where in the counter flow this is asked. */
  stage: 'DETAILS' | 'PARTICIPANTS' | 'ASSETS' | 'CHECKS'
  order: number
}

const activityFieldSchema = new Schema<ActivityFieldDoc>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    labelAr: { type: String, default: '' },
    kind: { type: String, enum: ACTIVITY_FIELD_KINDS, required: true },
    required: { type: Boolean, default: false },
    helpText: { type: String, default: '' },
    helpTextAr: { type: String, default: '' },
    options: {
      type: [{ _id: false, value: String, label: String, labelAr: String }],
      default: [],
    },
    min: { type: Number, default: null },
    max: { type: Number, default: null },
    step: { type: Number, default: null },
    assetTypeId: { type: String, default: null },
    stage: { type: String, enum: ['DETAILS', 'PARTICIPANTS', 'ASSETS', 'CHECKS'], default: 'DETAILS' },
    order: { type: Number, default: 0 },
  },
  { _id: false },
)

/* -------------------------------------------------------------------------------------- */
/* Rules — conditions, as data                                                               */
/* -------------------------------------------------------------------------------------- */

/**
 * The whole vocabulary of comparisons a tenant may write.
 *
 * Fixed on purpose. A rule is `{ field, operator, value }` and the engine knows how to
 * evaluate each operator; there is nowhere for an expression to be smuggled in, because there
 * is no expression — only a choice from this list.
 */
export const ACTIVITY_OPERATORS = [
  'IS_PRESENT',
  'IS_BLANK',
  'EQUALS',
  'NOT_EQUALS',
  'GREATER_THAN',
  'GREATER_OR_EQUAL',
  'LESS_THAN',
  'LESS_OR_EQUAL',
  'IS_ONE_OF',
  'IS_NOT_ONE_OF',
  'IS_TRUE',
  'IS_FALSE',
] as const
export type ActivityOperator = (typeof ACTIVITY_OPERATORS)[number]

export interface ActivityConditionDoc {
  field: string
  operator: ActivityOperator
  /** Ignored by the operators that take no operand (IS_PRESENT, IS_TRUE, …). */
  value: string
  values: string[]
}

const activityConditionSchema = new Schema<ActivityConditionDoc>(
  {
    field: { type: String, required: true },
    operator: { type: String, enum: ACTIVITY_OPERATORS, required: true },
    value: { type: String, default: '' },
    values: { type: [String], default: [] },
  },
  { _id: false },
)

export interface ActivityRuleDoc {
  key: string
  /** Shown to the agent when the rule stops them, so it has to say what to do about it. */
  message: string
  messageAr: string
  /** All conditions must hold for the rule to be satisfied. */
  conditions: ActivityConditionDoc[]
  /** What happens when it is not satisfied. */
  effect: 'BLOCK' | 'WARN' | 'REQUIRE_SUPERVISOR'
  /** Which transition this guards. Blank means it guards the sale itself. */
  appliesToTransition: string | null
  active: boolean
}

const activityRuleSchema = new Schema<ActivityRuleDoc>(
  {
    key: { type: String, required: true },
    message: { type: String, required: true },
    messageAr: { type: String, default: '' },
    conditions: { type: [activityConditionSchema], default: [] },
    effect: { type: String, enum: ['BLOCK', 'WARN', 'REQUIRE_SUPERVISOR'], default: 'BLOCK' },
    appliesToTransition: { type: String, default: null },
    active: { type: Boolean, default: true },
  },
  { _id: false },
)

/* -------------------------------------------------------------------------------------- */
/* Workflow — the states a booking moves through                                             */
/* -------------------------------------------------------------------------------------- */

export interface ActivityStateDoc {
  key: string
  label: string
  labelAr: string
  /** Exactly one state is where a booking begins. */
  initial: boolean
  /** A booking in a terminal state is finished and moves no further. */
  terminal: boolean
  /** Whether the clock is running here — what "in progress" means for this activity. */
  inProgress: boolean
  colour: string
  order: number
}

const activityStateSchema = new Schema<ActivityStateDoc>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    labelAr: { type: String, default: '' },
    initial: { type: Boolean, default: false },
    terminal: { type: Boolean, default: false },
    inProgress: { type: Boolean, default: false },
    colour: { type: String, default: '' },
    order: { type: Number, default: 0 },
  },
  { _id: false },
)

export interface ActivityTransitionDoc {
  key: string
  label: string
  labelAr: string
  from: string
  to: string
  /** Which jobs may take this step. Empty means anybody working the activity. */
  allowedRoles: string[]
  /** Whether money is collected as part of it. */
  takesPayment: boolean
  /** Whether the customer must have confirmed who they are first. */
  requiresCustomerProof: boolean
  order: number
}

const activityTransitionSchema = new Schema<ActivityTransitionDoc>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    labelAr: { type: String, default: '' },
    from: { type: String, required: true },
    to: { type: String, required: true },
    allowedRoles: { type: [String], default: [] },
    takesPayment: { type: Boolean, default: false },
    requiresCustomerProof: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { _id: false },
)

/* -------------------------------------------------------------------------------------- */
/* A revision — one frozen version of everything above                                       */
/* -------------------------------------------------------------------------------------- */

export interface ActivityRevisionDoc {
  revision: number
  publishedAt: Date
  publishedBy: string
  note: string
  fields: ActivityFieldDoc[]
  rules: ActivityRuleDoc[]
  states: ActivityStateDoc[]
  transitions: ActivityTransitionDoc[]
  pricing: {
    billingModel: string
    saleUnit: string
    basePrice: number
    durationUnit: string | null
    depositRequired: number
    overtimeHourlyRate: number | null
    gracePeriodMin: number
  }
  /* ------------------------------------------------------------------------------------ */
  /* Where it runs, who runs it, and what it runs on                                        */
  /*                                                                                        */
  /* An activity is the hub of the tenant's operating graph, not an entry on a settings      */
  /* page. Everything else hangs off these four lists: an employee's visible resources are   */
  /* the resources of the activities they work, at the locations they are posted to; a       */
  /* counter offers the activities that name it; and a job may only be assigned to an        */
  /* activity that allows it.                                                                */
  /*                                                                                         */
  /* Empty means "no restriction on this axis", which is the useful default — a tenant with  */
  /* one location should not have to enumerate it before anything works.                     */
  /* ------------------------------------------------------------------------------------ */

  /** The locations this runs at. Empty: anywhere in the tenant. */
  siteIds: string[]
  /** The operational areas within them. Empty: anywhere at those locations. */
  areaIds: string[]
  /** The counters that may sell it. Empty: any counter that holds the capability. */
  terminalIds: string[]
  /** The tenant's own jobs that may operate it, by role key. Empty: any job that may run sessions. */
  operatorRoleKeys: string[]

  /** Which kinds of thing this activity uses — horses, camels, scooters, compartments. */
  assetTypeIds: string[]
  /**
   * Named individual resources, when only some of a kind will do.
   *
   * A stable holds thirty horses and six of them are calm enough for a first-time rider.
   * Empty means every unit of the named kinds, which is the common case.
   */
  eligibleResourceIds: string[]
  /** Consumables a session draws on — feed, brushes, film. */
  consumableProductIds: string[]

  capacity: { seatsPerBooking: number | null; maxConcurrent: number | null }
}

const activityRevisionSchema = new Schema<ActivityRevisionDoc>(
  {
    revision: { type: Number, required: true },
    publishedAt: { type: Date, default: () => new Date() },
    publishedBy: { type: String, default: '' },
    note: { type: String, default: '' },
    fields: { type: [activityFieldSchema], default: [] },
    rules: { type: [activityRuleSchema], default: [] },
    states: { type: [activityStateSchema], default: [] },
    transitions: { type: [activityTransitionSchema], default: [] },
    pricing: {
      billingModel: { type: String, default: 'PACKAGE' },
      saleUnit: { type: String, default: 'TOUR' },
      basePrice: { type: Number, default: 0 },
      durationUnit: { type: String, default: null },
      depositRequired: { type: Number, default: 0 },
      overtimeHourlyRate: { type: Number, default: null },
      gracePeriodMin: { type: Number, default: 0 },
    },
    siteIds: { type: [String], default: [] },
    areaIds: { type: [String], default: [] },
    terminalIds: { type: [String], default: [] },
    operatorRoleKeys: { type: [String], default: [] },
    assetTypeIds: { type: [String], default: [] },
    eligibleResourceIds: { type: [String], default: [] },
    consumableProductIds: { type: [String], default: [] },
    capacity: {
      seatsPerBooking: { type: Number, default: null },
      maxConcurrent: { type: Number, default: null },
    },
  },
  { _id: false },
)

/* -------------------------------------------------------------------------------------- */
/* The definition                                                                            */
/* -------------------------------------------------------------------------------------- */

export interface ActivityDefinitionDoc {
  _id: string
  tenantId: string
  /** Stable, machine-readable, chosen once. Bookings and staff assignments refer to it. */
  key: string
  name: string
  nameAr: string
  description: string
  descriptionAr: string
  emoji: string
  colour: string
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  /** The version being edited. Never what a booking resolves against. */
  draft: Omit<ActivityRevisionDoc, 'revision' | 'publishedAt' | 'publishedBy'>
  /** Every version ever published, oldest first. Append-only. */
  revisions: ActivityRevisionDoc[]
  /** The revision new bookings are sold under. */
  currentRevision: number
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

const activityDefinitionSchema = new Schema<ActivityDefinitionDoc>(
  {
    _id: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    key: { type: String, required: true },
    name: { type: String, required: true },
    nameAr: { type: String, default: '' },
    description: { type: String, default: '' },
    descriptionAr: { type: String, default: '' },
    emoji: { type: String, default: '' },
    colour: { type: String, default: '' },
    status: { type: String, enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'], default: 'DRAFT', index: true },
    draft: {
      note: { type: String, default: '' },
      fields: { type: [activityFieldSchema], default: [] },
      rules: { type: [activityRuleSchema], default: [] },
      states: { type: [activityStateSchema], default: [] },
      transitions: { type: [activityTransitionSchema], default: [] },
      pricing: {
        billingModel: { type: String, default: 'PACKAGE' },
        saleUnit: { type: String, default: 'TOUR' },
        basePrice: { type: Number, default: 0 },
        durationUnit: { type: String, default: null },
        depositRequired: { type: Number, default: 0 },
        overtimeHourlyRate: { type: Number, default: null },
        gracePeriodMin: { type: Number, default: 0 },
      },
      siteIds: { type: [String], default: [] },
      areaIds: { type: [String], default: [] },
      terminalIds: { type: [String], default: [] },
      operatorRoleKeys: { type: [String], default: [] },
      assetTypeIds: { type: [String], default: [] },
      eligibleResourceIds: { type: [String], default: [] },
      consumableProductIds: { type: [String], default: [] },
      capacity: {
        seatsPerBooking: { type: Number, default: null },
        maxConcurrent: { type: Number, default: null },
      },
    },
    revisions: { type: [activityRevisionSchema], default: [] },
    currentRevision: { type: Number, default: 0 },
    createdBy: { type: String, default: '' },
  },
  { _id: false, timestamps: true },
)

// One key per tenant: a booking resolves its activity by key, so two would be ambiguous.
activityDefinitionSchema.index({ tenantId: 1, key: 1 }, { unique: true })

export const ActivityDefinition = model<ActivityDefinitionDoc>(
  'ActivityDefinition',
  activityDefinitionSchema,
  'activitydefinitions',
)

export { activityDefinitionSchema }
