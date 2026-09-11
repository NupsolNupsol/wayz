import { AsyncLocalStorage } from 'node:async_hooks'
import type { Model } from 'mongoose'
import { ApiError } from '../utils/ApiError.js'
import { platformDb, tenantConnection } from './connections.js'
import { modelsFor, type TenantModelName, type TenantModels } from './tenantModels.js'
import type { TenantRegistryDoc } from './registry.model.js'

/**
 * Which tenant the current unit of work belongs to.
 *
 * A request, a queued job, a scheduled sweep and a seed run are all "a unit of work", and
 * each one enters through `runInTenant`. Nothing reads a tenant from a header, a query
 * string or a body — by the time execution reaches here the tenant has already been
 * established from a signed token or from an explicit call in trusted server code.
 */

export interface TenantContext {
  tenantId: string
  slug: string
  dbName: string
  models: TenantModels
  registry: TenantRegistryDoc
}

const storage = new AsyncLocalStorage<TenantContext>()

export function currentTenant(): TenantContext | undefined {
  return storage.getStore()
}

/**
 * The tenant of the current unit of work, or a refusal.
 *
 * Deliberately throws rather than falling back to a default connection. A silent fallback
 * is how one tenant ends up reading another's database; a thrown error is a bug report
 * with a stack trace pointing at the caller.
 */
export function requireTenant(): TenantContext {
  const ctx = storage.getStore()
  if (!ctx) {
    throw ApiError.internal(
      'No tenant context. Tenant data can only be reached inside runInTenant() — see docs/platform/01-ARCHITECTURE.md (AD-4).',
    )
  }
  return ctx
}

/**
 * Registry rows, briefly cached.
 *
 * Every authenticated request resolves its tenant, so without this the control plane
 * takes a read per request — a bottleneck that arrives exactly when the platform starts
 * succeeding. The window is deliberately short: suspending a tenant has to take effect
 * in seconds, not on the next restart, and the Super Admin invalidates explicitly on any
 * change so the common case is immediate.
 */
const REGISTRY_TTL_MS = 5_000
const registryCache = new Map<string, { at: number; doc: TenantRegistryDoc }>()

export function forgetTenant(tenantId?: string): void {
  if (tenantId) registryCache.delete(tenantId)
  else registryCache.clear()
}

async function readRegistry(tenantId: string): Promise<TenantRegistryDoc | null> {
  const hit = registryCache.get(tenantId)
  if (hit && Date.now() - hit.at < REGISTRY_TTL_MS) return hit.doc

  const { TenantRegistry } = platformDb()
  const doc = await TenantRegistry.findById(tenantId).lean<TenantRegistryDoc>()
  if (doc) registryCache.set(tenantId, { at: Date.now(), doc })
  else registryCache.delete(tenantId)
  return doc
}

export async function resolveTenant(tenantId: string): Promise<TenantContext> {
  const registry = await readRegistry(tenantId)
  if (!registry) throw ApiError.unauthorized('Unknown tenant.')

  if (registry.lifecycle === 'SUSPENDED') {
    throw ApiError.forbidden(registry.suspendedReason || 'This tenant is suspended.')
  }
  if (registry.lifecycle === 'ARCHIVED') throw ApiError.forbidden('This tenant is archived.')
  if (registry.lifecycle === 'PROVISIONING' || registry.lifecycle === 'FAILED') {
    throw ApiError.unprocessable('This tenant is not ready yet.', [
      'Its database is still being prepared. A platform administrator can retry provisioning.',
    ])
  }

  const conn = await tenantConnection(registry.dbName)
  return {
    tenantId: registry._id,
    slug: registry.slug,
    dbName: registry.dbName,
    models: modelsFor(conn),
    registry,
  }
}

/** The only way into a tenant's data. Grep for it to find every entry point. */
export async function runInTenant<T>(tenantId: string, fn: (ctx: TenantContext) => Promise<T>): Promise<T> {
  const ctx = await resolveTenant(tenantId)
  return storage.run(ctx, () => fn(ctx))
}

/** For provisioning and tests, where the connection is known but the registry may not be ACTIVE yet. */
export async function runInTenantContext<T>(ctx: TenantContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn)
}

/**
 * Enters a tenant for a synchronous callback — Express's `next()`.
 *
 * Everything the callback starts asynchronously inherits the context, which is what lets
 * a whole request tree resolve to one tenant from a single call here.
 */
export function enterTenant(ctx: TenantContext, fn: () => void): void {
  storage.run(ctx, fn)
}

/**
 * A handle that always points at the current tenant's model.
 *
 * The 51 service files that `import { Booking } from '../models/index.js'` keep working
 * unchanged, but what they now hold is a view onto whichever tenant the current request
 * belongs to. Outside a tenant context every property access throws, so there is no
 * global model left to reach by accident.
 */
export function tenantModel<T = any>(name: TenantModelName): Model<T> {
  const handle = function () {} as unknown as Model<T>
  return new Proxy(handle, {
    get(_target, prop, receiver) {
      const model = requireTenant().models[name] as Model<T>
      const value = Reflect.get(model as object, prop, receiver)
      return typeof value === 'function' ? value.bind(model) : value
    },
    set(_target, prop, value) {
      const model = requireTenant().models[name] as Model<T>
      return Reflect.set(model as object, prop, value)
    },
    has(_target, prop) {
      return Reflect.has(requireTenant().models[name] as object, prop)
    },
    // `new Booking({...})` has to build a document on the tenant's own model.
    construct(_target, args) {
      const model = requireTenant().models[name] as unknown as new (...a: unknown[]) => object
      return new model(...args)
    },
    getPrototypeOf() {
      return Reflect.getPrototypeOf(requireTenant().models[name] as object)
    },
  })
}
