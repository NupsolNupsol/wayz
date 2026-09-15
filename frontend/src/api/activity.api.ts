import { http, unwrap } from './client'

/**
 * Activities a tenant defines for itself.
 *
 * The counter-facing list (`published`) and the authoring endpoints are deliberately separate:
 * an agent needs the shape of what they are selling and has no business seeing drafts,
 * revision history or anything a manager is still working on.
 */

export const ACTIVITY_FIELD_KINDS = [
  'TEXT',
  'NUMBER',
  'SELECT',
  'BOOLEAN',
  'DATE',
  'TIME',
  'PHONE',
  'NATIONAL_ID',
  'CUSTOMER',
  'ASSET_UNIT',
  'STAFF',
  'NOTE',
] as const
export type ActivityFieldKind = (typeof ACTIVITY_FIELD_KINDS)[number]

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

/** Said the way a person reading a rule would say it. */
export const OPERATOR_LABEL: Record<ActivityOperator, string> = {
  IS_PRESENT: 'is filled in',
  IS_BLANK: 'is left blank',
  EQUALS: 'is exactly',
  NOT_EQUALS: 'is not',
  GREATER_THAN: 'is more than',
  GREATER_OR_EQUAL: 'is at least',
  LESS_THAN: 'is less than',
  LESS_OR_EQUAL: 'is at most',
  IS_ONE_OF: 'is one of',
  IS_NOT_ONE_OF: 'is none of',
  IS_TRUE: 'is ticked',
  IS_FALSE: 'is not ticked',
}

export const FIELD_KIND_LABEL: Record<ActivityFieldKind, string> = {
  TEXT: 'Text',
  NUMBER: 'Number',
  SELECT: 'Choice',
  BOOLEAN: 'Tick box',
  DATE: 'Date',
  TIME: 'Time',
  PHONE: 'Phone number',
  NATIONAL_ID: 'National ID',
  CUSTOMER: 'Customer',
  ASSET_UNIT: 'Asset',
  STAFF: 'Member of staff',
  NOTE: 'Note',
}

/** Which operators make sense for which kind of question. */
export const OPERATORS_FOR: Record<ActivityFieldKind, ActivityOperator[]> = {
  TEXT: ['IS_PRESENT', 'IS_BLANK', 'EQUALS', 'NOT_EQUALS'],
  NUMBER: ['IS_PRESENT', 'GREATER_THAN', 'GREATER_OR_EQUAL', 'LESS_THAN', 'LESS_OR_EQUAL', 'EQUALS', 'NOT_EQUALS'],
  SELECT: ['IS_PRESENT', 'EQUALS', 'NOT_EQUALS', 'IS_ONE_OF', 'IS_NOT_ONE_OF'],
  BOOLEAN: ['IS_TRUE', 'IS_FALSE'],
  DATE: ['IS_PRESENT', 'IS_BLANK'],
  TIME: ['IS_PRESENT', 'IS_BLANK'],
  PHONE: ['IS_PRESENT', 'IS_BLANK'],
  NATIONAL_ID: ['IS_PRESENT', 'IS_BLANK'],
  CUSTOMER: ['IS_PRESENT', 'IS_BLANK'],
  ASSET_UNIT: ['IS_PRESENT', 'IS_BLANK'],
  STAFF: ['IS_PRESENT', 'IS_BLANK'],
  NOTE: ['IS_PRESENT', 'IS_BLANK'],
}

export interface ActivityOption {
  value: string
  label: string
  labelAr: string
}

export interface ActivityField {
  key: string
  label: string
  labelAr: string
  kind: ActivityFieldKind
  required: boolean
  helpText: string
  helpTextAr: string
  options: ActivityOption[]
  min: number | null
  max: number | null
  step: number | null
  assetTypeId: string | null
  stage: 'DETAILS' | 'PARTICIPANTS' | 'ASSETS' | 'CHECKS'
  order: number
}

export interface ActivityCondition {
  field: string
  operator: ActivityOperator
  value: string
  values: string[]
}

export interface ActivityRule {
  key: string
  message: string
  messageAr: string
  conditions: ActivityCondition[]
  effect: 'BLOCK' | 'WARN' | 'REQUIRE_SUPERVISOR'
  appliesToTransition: string | null
  active: boolean
}

export interface ActivityState {
  key: string
  label: string
  labelAr: string
  initial: boolean
  terminal: boolean
  inProgress: boolean
  colour: string
  order: number
}

export interface ActivityTransition {
  key: string
  label: string
  labelAr: string
  from: string
  to: string
  allowedRoles: string[]
  takesPayment: boolean
  requiresCustomerProof: boolean
  order: number
}

export interface ActivityPricing {
  billingModel: string
  saleUnit: string
  basePrice: number
  durationUnit: string | null
  depositRequired: number
  overtimeHourlyRate: number | null
  gracePeriodMin: number
}

/**
 * Where an activity runs, who runs it, and what it runs on.
 *
 * The activity is the hub of a tenant's operating graph: an employee's visible resources are
 * the resources of the activities they work at the locations they are posted to, a counter
 * offers the activities that name it, and a job may only be assigned to an activity that
 * allows it. Empty on any axis means "no restriction there".
 */
export interface ActivityGraph {
  siteIds: string[]
  areaIds: string[]
  terminalIds: string[]
  operatorRoleKeys: string[]
  assetTypeIds: string[]
  eligibleResourceIds: string[]
  consumableProductIds: string[]
}

export interface ActivityDraft extends ActivityGraph {
  note: string
  fields: ActivityField[]
  rules: ActivityRule[]
  states: ActivityState[]
  transitions: ActivityTransition[]
  pricing: ActivityPricing
  capacity: { seatsPerBooking: number | null; maxConcurrent: number | null }
}

export interface ActivityRevision extends ActivityDraft {
  revision: number
  publishedAt: string
  publishedBy: string
}

export interface ActivityDefinition {
  _id: string
  key: string
  name: string
  nameAr: string
  description: string
  emoji: string
  colour: string
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  draft: ActivityDraft
  revisions: ActivityRevision[]
  currentRevision: number
  createdAt: string
  updatedAt: string
}

/** What a counter is given: the published shape, and nothing that is still being worked on. */
export interface PublishedActivity {
  id: string
  key: string
  name: string
  nameAr: string
  description: string
  emoji: string
  colour: string
  status: string
  revision: number
  fields: ActivityField[]
  states: ActivityState[]
  transitions: ActivityTransition[]
  pricing: ActivityPricing | null
  assetTypeIds: string[]
  siteIds: string[]
  areaIds: string[]
  terminalIds: string[]
  operatorRoleKeys: string[]
  eligibleResourceIds: string[]
  capacity: { seatsPerBooking: number | null; maxConcurrent: number | null } | null
}

export interface ActivityProblem {
  where: string
  problem: string
}

/**
 * The tenant's own estate, jobs and things — what an activity may be wired to.
 *
 * Every list here comes out of the tenant's own database. None of it is a platform constant,
 * which is the difference between a builder that offers a company what it has and one that
 * offers it somebody else's business.
 */
export interface ActivityGraphOptions {
  sites: { id: string; name: string }[]
  areas: { id: string; siteId: string; name: string }[]
  terminals: { id: string; areaId: string; name: string }[]
  roles: { key: string; label: string }[]
  resourceKinds: { id: string; name: string }[]
  resources: { id: string; kindId: string; identifier: string; areaId: string | null }[]
  products: { id: string; name: string }[]
}

export interface ActivityVocabulary {
  fieldKinds: ActivityFieldKind[]
  operators: ActivityOperator[]
  effects: string[]
  stages: string[]
  billingModels: string[]
  saleUnits: string[]
  durationUnits: string[]
  graph: ActivityGraphOptions
}

export const activityApi = {
  list: () => unwrap<ActivityDefinition[]>(http.get('/activities')),
  published: () => unwrap<PublishedActivity[]>(http.get('/activities/published')),
  detail: (id: string) => unwrap<ActivityDefinition>(http.get(`/activities/${id}`)),

  /** The platform's vocabulary and the tenant's own things, in one call. */
  vocabulary: () => unwrap<ActivityVocabulary>(http.get('/activities/vocabulary')),

  create: (input: { key: string; name: string; nameAr?: string; emoji?: string; description?: string }) =>
    unwrap<ActivityDefinition>(http.post('/activities', input)),

  saveDraft: (id: string, patch: Partial<ActivityDraft> & { name?: string; nameAr?: string; emoji?: string; description?: string }) =>
    unwrap<ActivityDefinition>(http.patch(`/activities/${id}`, patch)),

  /** What is wrong with the draft, without committing to anything. */
  check: (id: string) =>
    unwrap<{ publishable: boolean; problems: ActivityProblem[] }>(http.get(`/activities/${id}/check`)),

  publish: (id: string, note?: string) =>
    unwrap<ActivityDefinition>(http.post(`/activities/${id}/publish`, { note })),

  setStatus: (id: string, status: 'PUBLISHED' | 'ARCHIVED') =>
    unwrap<ActivityDefinition>(http.post(`/activities/${id}/status`, { status })),

  /** Only for one nothing has been sold under. Anything used is archived instead. */
  remove: (id: string) => unwrap<{ removed: string }>(http.delete(`/activities/${id}`)),
}
