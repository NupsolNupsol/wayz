import type { NextFunction, Request, Response } from 'express';

import { ApiError } from '../utils/ApiError.js';
import { appDb } from './connections.js';
import { enterOrg, runAcrossOrganisations } from './orgScope.js';

/**
 * Links a customer follows without signing in.
 *
 * A tracking page, an invoice, an invitation to set a password: each is reached by a token in
 * the URL and by nothing else. There is no session, so the organisation has to be worked out
 * from the token itself before any handler runs.
 *
 * ## What this replaced
 *
 * Two directories — one mapping an email to a database and one mapping a token to a database —
 * which existed because a connection had to be chosen before anything could be read. They had
 * to be kept in sync with the records they described, they had to be reindexed at boot, and a
 * missed write meant a link that silently would not open.
 *
 * With one database none of that is needed: the record carrying the token is simply found, and
 * the organisation is the one written on it. The directories are gone and so is every way they
 * could drift.
 */

/**
 * The collections that issue public tokens, and the field each keeps them in.
 *
 * Each field is the one the handler behind that link actually looks the token up by, which is
 * not the same field in all three: an invoice's token *is* its `_id`, while a booking keeps a
 * separate `trackingToken` and an invitation stores only a hash. Guessing a uniform `token`
 * field here produced a 404 on every invoice link — the middleware found no owning
 * organisation, so the handler never ran.
 */
const TOKEN_HOLDERS = [
  { model: 'Booking', field: 'trackingToken' },
  { model: 'InvoiceDoc', field: '_id' },
  { model: 'User', field: 'invite.tokenHash' },
] as const;

/**
 * Which organisation owns a public token.
 *
 * Searched across every organisation, deliberately: nobody has said who they are yet, which is
 * the whole point of a link that works without signing in. The token is long and random, so
 * finding it is the authorisation.
 */
async function organisationForToken(token: string): Promise<string | null> {
  return runAcrossOrganisations(async () => {
    const models = appDb();
    for (const { model, field } of TOKEN_HOLDERS) {
      const found = await (
        models[model] as {
          findOne: (f: object, p: object) => { lean: () => Promise<{ tenantId?: string } | null> };
        }
      )
        .findOne({ [field]: token }, { tenantId: 1 })
        .lean();
      if (found?.tenantId) return found.tenantId;
    }
    return null;
  });
}

/**
 * Enters the organisation that issued the token in the URL.
 *
 * `key` lets a route hand over a hash of the token rather than the token itself, which is what
 * invitations do — the raw value reaches the customer's inbox and only its hash is stored.
 */
export function withPublicLinkOrg(param: string, key: (raw: string) => string = (raw) => raw) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const raw = String(req.params[param] ?? '');
    if (!raw) return next(ApiError.notFound('That link has expired.'));

    organisationForToken(key(raw))
      .then((organizationId) => {
        if (!organizationId) return next(ApiError.notFound('That link has expired.'));
        enterOrg(organizationId, next);
      })
      .catch(next);
  };
}
