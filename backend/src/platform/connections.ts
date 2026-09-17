import mongoose, { type Connection } from 'mongoose';

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ApiError } from '../utils/ApiError.js';
import { modelsFor, type SharedModelName, type SharedModels } from './sharedModels.js';
import type { Model } from 'mongoose';

/**
 * One database, shared by every organisation.
 *
 * This replaced a database-per-organisation design. That design made isolation a property of
 * the *connection*, which was strong, and made everything else harder than it needed to be:
 * a person could not be found before their organisation was known, cross-organisation
 * reporting meant fan-out, and every new collection had to be provisioned into every existing
 * database.
 *
 * Isolation is now a property of the *query*, and specifically of one piece of query
 * middleware rather than of four hundred hand-written filters — see `orgScope.ts`. That is
 * the only reason a shared database is safe here, and it is worth knowing before adding a
 * collection that bypasses it.
 */

/** The base URI with its path stripped, so a database name can be attached to it. */
function baseUri(): string {
  const uri = env.MONGODB_URI;
  // mongodb://host:port/db?opts  →  mongodb://host:port/?opts
  const marker = uri.indexOf('://') + 3;
  const rest = uri.slice(marker);
  const slash = rest.indexOf('/');
  if (slash === -1) return uri;
  const query = rest.indexOf('?');
  const tail = query === -1 ? '' : rest.slice(query);
  return uri.slice(0, marker) + rest.slice(0, slash) + '/' + tail;
}

function uriFor(dbName: string): string {
  const base = baseUri();
  const [head, query] = base.split('?');
  return `${head.replace(/\/$/, '')}/${dbName}${query ? `?${query}` : ''}`;
}

/**
 * A database name we are willing to open.
 *
 * The name comes from configuration rather than from anything a client sends, so this should
 * never fire — which is exactly why it is here. If the environment is ever written badly the
 * damage stops at a refusal rather than reaching the driver.
 */
const SAFE_DB_NAME = /^[a-z0-9_]{1,48}$/;

export function assertSafeDbName(dbName: string): string {
  if (!SAFE_DB_NAME.test(dbName)) {
    throw ApiError.internal('Refusing to open a database with an unexpected name.');
  }
  return dbName;
}

/**
 * The application database.
 *
 * Defaults to the database WAYZ's records already live in, so this change moved no data. A
 * deployment that wants a different name sets `APP_DB_NAME`.
 */
export function appDbName(): string {
  return assertSafeDbName(env.APP_DB_NAME);
}

let connection: Connection | null = null;
let models: SharedModels | null = null;

export async function connectApp(): Promise<Connection> {
  if (connection && connection.readyState === 1) return connection;

  const conn = mongoose.createConnection(uriFor(appDbName()), {
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 20,
  });
  await conn.asPromise();

  connection = conn;
  models = modelsFor(conn);
  logger.info('Database connected', { db: conn.name });
  return conn;
}

export function appDb(): SharedModels {
  if (!models) throw ApiError.internal('The database is not connected yet.');
  return models;
}

export function appConnection(): Connection {
  if (!connection) throw ApiError.internal('The database is not connected yet.');
  return connection;
}

export async function closeAllConnections(): Promise<void> {
  if (connection) {
    await connection.close();
    connection = null;
    models = null;
  }
}

/**
 * A handle that resolves to a model once the connection is open.
 *
 * The fifty-odd service files that `import { Booking } from '../models/index.js'` keep working
 * unchanged. The indirection is still worth having: models cannot be bound at import time
 * because the connection is not open yet, and a module-level `conn.model(...)` would either
 * force connection order on every import or hand back a model bound to nothing.
 *
 * Organisation scoping is not done here — it is query middleware on the schema, so it applies
 * however a collection is reached, including through a model resolved some other way.
 */
export function appModel<T = unknown>(name: SharedModelName): Model<T> {
  const handle = function () {} as unknown as Model<T>;
  return new Proxy(handle, {
    get(_target, prop, receiver) {
      const model = appDb()[name] as Model<T>;
      const value = Reflect.get(model as object, prop, receiver);
      return typeof value === 'function' ? value.bind(model) : value;
    },
    set(_target, prop, value) {
      return Reflect.set(appDb()[name] as object, prop, value);
    },
    has(_target, prop) {
      return Reflect.has(appDb()[name] as object, prop);
    },
    construct(_target, args) {
      const Bound = appDb()[name] as unknown as new (...a: unknown[]) => unknown;
      return new Bound(...args) as object;
    },
  });
}
