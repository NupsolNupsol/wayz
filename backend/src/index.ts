import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { seedIfEmpty } from './seed/seed.js';
import { bootstrapApp, organisationIds } from './platform/bootstrap.js';
import { ensurePlatformAdmin } from './platform/platformAdminBootstrap.js';
import { runInOrg } from './platform/orgScope.js';
import { startReminderWorker } from './workers/reminder.worker.js';
import { runSessionSweeps } from './services/overtime.service.js';
import { isPubliclyFetchable } from './services/vonage.service.js';
import { isStaticOtpActive } from './services/otp.service.js';

async function main() {
  await bootstrapApp();

  /*
   * Before anything else, so that a deployment whose seeding fails still has somebody who can
   * sign in and look at why. Does nothing unless the environment configures one.
   */
  await ensurePlatformAdmin();

  /*
   * Seeding runs once per organisation, because a seed writes rows that belong to one.
   *
   * There is no directory to reconcile any more: a person is found by their email and a
   * public link by its token, both directly out of the one database they live in.
   */
  if (env.AUTO_SEED) {
    for (const organizationId of await organisationIds()) {
      await runInOrg(organizationId, () => seedIfEmpty());
    }
  }

  if (env.QUEUE_ENABLED) {
    await startReminderWorker();
  } else {
    /*
     * Sweeps run once per organisation rather than once over the whole collection.
     *
     * A sweep closes overdue sessions and charges overtime, and both read an organisation's
     * own operating rules. Running it unscoped would apply one company's grace period to
     * another company's bookings.
     */
    setInterval(() => {
      void (async () => {
        for (const organizationId of await organisationIds()) {
          await runInOrg(organizationId, () => runSessionSweeps()).catch(() => undefined);
        }
      })();
    }, 60_000).unref();
  }

  /*
   * A standing confirmation code is a hole in identity checking, deliberately opened.
   *
   * It exists so a test team can get past a code they cannot read, and on a dev server that is
   * the right trade. On a server real customers reach it is not, and the way that mistake happens
   * is a .env copied from staging without anyone re-reading it. So it says so at every boot,
   * loudly and by name, rather than sitting silently in a config file.
   */
  if (isStaticOtpActive()) {
    logger.warn(
      'A standing confirmation code is active: any customer can be confirmed without one being sent',
      {
        mode: env.MODE,
        whyItIsOn: 'MODE=dev and STATIC_OTP is set',
        turnItOff: 'Set MODE=live, or unset STATIC_OTP, on any deployment customers can reach.',
      }
    );
  }

  const publicApi = env.PUBLIC_API_URL ?? '';
  if (!isPubliclyFetchable(publicApi)) {
    logger.warn(
      'WhatsApp invoices will send as text only: PUBLIC_API_URL is not publicly reachable',
      {
        publicApiUrl: publicApi || '(unset)',
        fix: 'Expose the API (e.g. cloudflared tunnel --url http://localhost:4000) and set PUBLIC_API_URL to that https address.',
      }
    );
  }

  const trackingHome = env.PUBLIC_APP_URL;
  const reachable = await fetch(`${trackingHome.replace(/\/$/, '')}/`, { method: 'HEAD' })
    .then((r) => r.status < 500)
    .catch(() => false);
  if (!reachable) {
    logger.warn('Customers cannot open their tracking link: PUBLIC_APP_URL does not answer', {
      publicAppUrl: trackingHome,
      sentIn: 'expiry warnings, invoices and the tracking QR',
      fix: 'Point PUBLIC_APP_URL at the address that actually serves the web app, and make sure that host serves frontend/dist.',
    });
  }

  const app = createApp();
  const server = app.listen(env.PORT, () =>
    logger.info('WAYZ API listening', { port: env.PORT, env: env.NODE_ENV })
  );

  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
}

main().catch((err) => {
  logger.error('Boot failed', { err: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
