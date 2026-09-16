import { AsyncLocalStorage } from 'node:async_hooks'
import type { Aggregate, Query, Schema } from 'mongoose'

import { ApiError } from '../utils/ApiError.js'

/**
 * Which organisation the current unit of work belongs to.
 *
 * A request, a queued job, a scheduled sweep and a seed run are each "a unit of work", and
 * each one enters through `runInOrg`. Nothing reads an organisation from a header, a query
 * string or a body — by the time execution reaches here it has been established from a signed
 * token or from an explicit call in trusted server code.
 *
 * ## Why this exists at all
 *
 * Every organisation shares one database, so what separates them is a `tenantId` on each
 * document. All of them belong to the same real client, so this is **data hygiene and correct
 * reporting**, not a security perimeter — nobody here is defending against a hostile tenant.
 *
 * It still has to be automatic. There are over four hundred query sites in this codebase, and
 * a single forgotten filter does not produce an error: it produces a revenue report that
 * quietly includes another organisation's takings, which is the kind of wrong that is believed
 * before it is noticed.
 *
 * So the filter is not written by hand. `scopeToOrganisation` installs query middleware on
 * every shared schema that injects the current organisation into reads, writes and
 * aggregations alike. A developer who forgets is scoped correctly anyway; a developer who
 * writes it explicitly gets the same answer.
 *
 * The escape hatch is deliberately loud: `runAcrossOrganisations` — used by the sign-in
 * directory and by seeding, and by nothing else.
 */

interface OrgContext {
  /** The organisation every query in this unit of work is confined to. */
  organizationId: string
  /**
   * Set only inside `runAcrossOrganisations`.
   *
   * Reading data belonging to no particular organisation is a real requirement — a unified
   * sign-in page has to find a person before it knows which company they work for — but it is
   * rare enough that it should be visible in a stack trace.
   */
  unscoped?: true
}

const storage = new AsyncLocalStorage<OrgContext>()

export function currentOrganisation(): string | undefined {
  const ctx = storage.getStore()
  return ctx?.unscoped ? undefined : ctx?.organizationId
}

/**
 * The organisation of the current unit of work, or a refusal.
 *
 * Deliberately throws rather than falling back to "all organisations". A silent fallback is
 * how one company ends up reading another's records; a thrown error is a bug report with a
 * stack trace pointing at the caller.
 */
export function requireOrganisation(): string {
  const ctx = storage.getStore()
  if (!ctx || ctx.unscoped) {
    throw ApiError.internal(
      'No organisation context. Shared data can only be reached inside runInOrg() — see docs/platform/01-ARCHITECTURE.md.',
    )
  }
  return ctx.organizationId
}

/** The only way into an organisation's data. Grep for it to find every entry point. */
export function runInOrg<T>(organizationId: string, fn: () => Promise<T>): Promise<T> {
  return storage.run({ organizationId }, fn)
}

/** Enters an organisation for a synchronous callback — Express's `next()`. */
export function enterOrg(organizationId: string, fn: () => void): void {
  storage.run({ organizationId }, fn)
}

/**
 * Reads across every organisation — the deliberate exception, kept small.
 *
 * Organisation scoping is automatic precisely so that nobody has to remember it. This is the
 * one way out of it, and it is named loudly so that every use shows in a stack trace and in
 * one grep. **Five call sites, and each is here because the question genuinely has no
 * organisation yet:**
 *
 * | Where | Why it cannot be scoped |
 * |---|---|
 * | `services/auth.service.ts` | sign-in finds the person *before* their organisation is known — that is what one neutral door means |
 * | `controllers/signIn.controller.ts` | the door lists demonstration accounts grouped by organisation, so it must see all of them |
 * | `platform/publicAccess.ts` | a tracking or invoice link carries a token and no session; the token's owner is what is being looked up |
 * | `platform/bootstrap.ts` | producing the list of organisations cannot be done from inside one |
 * | `seed/onboarding.seed.ts` | a progress row's `_id` is the user's id and so is unique across the whole collection, not within one organisation |
 *
 * Before adding a sixth, check the question is really organisation-less. "It returned nothing
 * and this made it work" is a scoping bug being worked around, and the fix is upstream.
 *
 * Reads only, by convention: nothing here writes across organisations. The onboarding upsert
 * writes one row addressed by a globally unique primary key, and stamps the organisation it
 * belongs to explicitly.
 */
export function runAcrossOrganisations<T>(fn: () => Promise<T>): Promise<T> {
  return storage.run({ organizationId: '', unscoped: true }, fn)
}

/* ------------------------------------------------------------------------------------- */
/* The plugin                                                                              */
/* ------------------------------------------------------------------------------------- */

/** Every read that returns documents, and every write that selects them by filter. */
const FILTERED_OPS = [
  'count',
  'countDocuments',
  'deleteMany',
  'deleteOne',
  'distinct',
  'estimatedDocumentCount',
  'find',
  'findOne',
  'findOneAndDelete',
  'findOneAndReplace',
  'findOneAndUpdate',
  'replaceOne',
  'update',
  'updateMany',
  'updateOne',
] as const

/**
 * Confines a schema's collection to one organisation.
 *
 * Applied to every shared schema in `sharedModels.ts`. Three hooks, because Mongoose reaches
 * a collection three different ways:
 *
 *  - **queries** — the filter gains `tenantId`, unless the caller already set it. An explicit
 *    value is honoured rather than overwritten, so trusted server code can still address a
 *    specific organisation, and a caller who names a *different* one inside a scoped context
 *    is refused outright rather than quietly given the wrong rows.
 *  - **saves** — a new document is stamped with the current organisation before it is
 *    validated, so a forgotten field cannot create an orphan row that every organisation can
 *    see, and cannot fail validation for a field the plugin was about to fill in.
 *  - **aggregations** — a `$match` on `tenantId` is unshifted to the front of the pipeline,
 *    where it also does the most good for the index.
 */
export function scopeToOrganisation(schema: Schema): void {
  const confine = function (this: Query<unknown, unknown>) {
    const organizationId = currentOrganisation()
    if (!organizationId) return

    const filter = this.getFilter() as Record<string, unknown>
    if (!filter) return

    const named = filter.tenantId
    if (named === undefined) {
      filter.tenantId = organizationId
      return
    }

    /*
     * Addressing another organisation from inside a scoped context is a bug, not an attack —
     * and it is worth failing loudly rather than silently returning nothing, because the
     * symptom of the silent version is an empty screen with no explanation.
     */
    if (typeof named === 'string' && named !== organizationId) {
      throw ApiError.internal(
        `Query named organisation "${named}" while working inside "${organizationId}".`,
      )
    }
  }

  for (const op of FILTERED_OPS) schema.pre(op as 'find', confine)

  /*
   * Stamped at `validate`, not at `save`.
   *
   * Mongoose runs validation *before* the save hooks, and `tenantId` is a required field on
   * most of these schemas — so stamping it in `pre('save')` arrived one step too late and every
   * `create()` without an explicit organisation failed validation instead of being scoped.
   */
  schema.pre('validate', function () {
    const doc = this as unknown as { tenantId?: string }
    if (!doc.tenantId) {
      const organizationId = currentOrganisation()
      if (organizationId) doc.tenantId = organizationId
    }
  })

  /*
   * `insertMany` is the one hook Mongoose hands a `next`, and it waits for it.
   *
   * Declaring the parameter and not calling it does not fail — it hangs, silently and for
   * ever, which is a far worse failure than an exception. Every path out of here calls it.
   */
  schema.pre('insertMany', function (next: (err?: Error) => void, docs: unknown) {
    try {
      const organizationId = currentOrganisation()
      if (organizationId && Array.isArray(docs)) {
        for (const doc of docs as { tenantId?: string }[]) {
          if (!doc.tenantId) doc.tenantId = organizationId
        }
      }
      next()
    } catch (err) {
      next(err as Error)
    }
  })

  schema.pre('aggregate', function (this: Aggregate<unknown[]>) {
    const organizationId = currentOrganisation()
    if (!organizationId) return

    const pipeline = this.pipeline() as unknown as Record<string, unknown>[]
    const first = pipeline[0] as { $match?: Record<string, unknown> } | undefined
    if (first?.$match && first.$match.tenantId === undefined) {
      first.$match.tenantId = organizationId
      return
    }
    if (!first?.$match) pipeline.unshift({ $match: { tenantId: organizationId } })
  })
}
