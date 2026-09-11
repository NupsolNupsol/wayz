import mongoose, { type Connection, type Model } from 'mongoose'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { ApiError } from '../utils/ApiError.js'
import {
  platformAdminSchema,
  platformAuditSchema,
  tenantRegistrySchema,
  type PlatformAdminDoc,
  type PlatformAuditDoc,
  type TenantRegistryDoc,
} from './registry.model.js'
import { VersionSchema, type VersionDoc } from '../models/version.model.js'

/**
 * Connections, and the rule about who may open one.
 *
 * There are two kinds of database here: one control plane and any number of tenants.
 * The control plane holds the registry that decides a tenant's database name; a tenant
 * connection can only be opened for a name that came off a registry document. Nothing a
 * client sends reaches this file.
 */

/** The base URI with its path stripped, so a database name can be attached to it. */
function baseUri(): string {
  const uri = env.MONGODB_URI
  // mongodb://host:port/db?opts  →  mongodb://host:port/?opts
  const marker = uri.indexOf('://') + 3
  const rest = uri.slice(marker)
  const slash = rest.indexOf('/')
  if (slash === -1) return uri
  const query = rest.indexOf('?')
  const tail = query === -1 ? '' : rest.slice(query)
  return uri.slice(0, marker) + rest.slice(0, slash) + '/' + tail
}

function uriFor(dbName: string): string {
  const base = baseUri()
  const [head, query] = base.split('?')
  return `${head.replace(/\/$/, '')}/${dbName}${query ? `?${query}` : ''}`
}

/**
 * A database name we are willing to open.
 *
 * The name always comes from the registry, so this should never fire — which is exactly
 * why it is here. If a registry row is ever written badly, or through a path nobody
 * anticipated, the damage stops at a refusal rather than reaching the driver.
 */
const SAFE_DB_NAME = /^[a-z0-9_]{1,48}$/

export function assertSafeDbName(dbName: string): string {
  if (!SAFE_DB_NAME.test(dbName)) {
    throw ApiError.internal(`Refusing to open a database with an unexpected name.`)
  }
  return dbName
}

export function tenantDbNameFor(slug: string): string {
  return assertSafeDbName(`${env.TENANT_DB_PREFIX}${slug}`.toLowerCase().replace(/-/g, '_'))
}

// ----------------------------------------------------------------- control plane

let platform: Connection | null = null

export interface PlatformModels {
  TenantRegistry: Model<TenantRegistryDoc>
  PlatformAdmin: Model<PlatformAdminDoc>
  PlatformAudit: Model<PlatformAuditDoc>
  /**
   * The release notes describe the platform, not any one tenant, and are readable
   * without signing in — so they live here rather than being copied into every tenant.
   */
  Version: Model<VersionDoc>
}

let platformModels: PlatformModels | null = null

export async function connectPlatform(): Promise<Connection> {
  if (platform) return platform
  const conn = mongoose.createConnection(uriFor(assertSafeDbName(env.PLATFORM_DB_NAME)), {
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 10,
  })
  await conn.asPromise()
  platform = conn
  logger.info('Control plane connected', { db: conn.name })
  return conn
}

export function platformDb(): PlatformModels {
  if (!platform) throw ApiError.internal('The control plane is not connected yet.')
  if (!platformModels) {
    platformModels = {
      TenantRegistry: platform.model<TenantRegistryDoc>('TenantRegistry', tenantRegistrySchema),
      PlatformAdmin: platform.model<PlatformAdminDoc>('PlatformAdmin', platformAdminSchema),
      PlatformAudit: platform.model<PlatformAuditDoc>('PlatformAudit', platformAuditSchema),
      Version: platform.model<VersionDoc>('Version', VersionSchema),
    }
  }
  return platformModels
}

// --------------------------------------------------------------- tenant plane

const tenantConnections = new Map<string, Connection>()

/**
 * Opens (or reuses) a tenant's connection.
 *
 * Cached by database name because opening a connection per request would exhaust the
 * server long before the tenant count did. Each carries its own modest pool; the cache
 * is the reason "many tenants" does not mean "many thousands of sockets".
 */
export async function tenantConnection(dbName: string): Promise<Connection> {
  const safe = assertSafeDbName(dbName)
  const existing = tenantConnections.get(safe)
  if (existing && existing.readyState === 1) return existing

  const conn = mongoose.createConnection(uriFor(safe), {
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 8,
  })
  await conn.asPromise()
  tenantConnections.set(safe, conn)
  logger.info('Tenant database connected', { db: safe })
  return conn
}

export async function closeAllConnections(): Promise<void> {
  for (const [name, conn] of tenantConnections) {
    await conn.close()
    tenantConnections.delete(name)
  }
  if (platform) {
    await platform.close()
    platform = null
    platformModels = null
  }
}

/** Every tenant database currently open — used by health checks and tests. */
export function openTenantDatabases(): string[] {
  return [...tenantConnections.keys()]
}
