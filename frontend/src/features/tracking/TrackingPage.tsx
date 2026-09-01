import { useParams } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2, PackageSearch, ShieldAlert, CheckCircle2, Clock, TriangleAlert } from 'lucide-react'
import { clsx } from 'clsx'
import { usePublicTracking } from '@/hooks'
import { useNow } from '@/hooks/useNow'
import { LanguageToggle } from '@/components/LanguageToggle'
import { humanizeRemaining } from '@/utils'
import type { PublicTracking } from '@/api/types'

export function TrackingPage() {
  const { t } = useTranslation(['ui', 'status'])
  const { id } = useParams()
  const { data, isLoading, isError } = usePublicTracking(id)

  return (
    <div className="min-h-screen bg-canvas dark:bg-dk-bg px-4 py-6 sm:py-10" data-testid="tracking-page">
      <div className="mx-auto w-full max-w-md">
        {/* The customer never signs in, so this is their only way to choose a language. */}
        <div className="flex justify-end mb-2">
          <LanguageToggle compact />
        </div>
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-24 text-muted">
            <Loader2 className="animate-spin" size={18} /> {t('tracking.loading')}
          </div>
        )}

        {isError && (
          <div className="lf-card p-6 text-center" data-testid="tracking-not-found">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-danger-strong dark:bg-red-900/30">
              <PackageSearch size={26} />
            </div>
            <h1 className="text-lg font-bold text-navy dark:text-dk-texthi">{t('tracking.notFound')}</h1>
            <p className="mt-1 text-sm text-muted">{t('tracking.notFoundHint')}</p>
          </div>
        )}

        {data && <TrackingCard data={data} />}
      </div>
    </div>
  )
}

function TrackingCard({ data }: { data: PublicTracking }) {
  const { t } = useTranslation(['ui', 'status'])
  const now = useNow(1000)
  const o = data.overtime
  const finished = data.status === 'COMPLETED' || data.status === 'CANCELLED'

  const msToDue = data.expectedEndAt ? new Date(data.expectedEndAt).getTime() - now : null
  const msToPenalty = data.graceEndsAt ? new Date(data.graceEndsAt).getTime() - now : null

  return (
    <div className="flex flex-col gap-4">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{data.brandName}</p>
        <h1 className="mt-1 text-2xl font-bold text-navy dark:text-dk-texthi" data-testid="tracking-ref">{data.ref}</h1>
        <p className="text-sm text-muted">{data.productName}</p>
      </header>

      <CountdownCard data={data} msToDue={msToDue} msToPenalty={msToPenalty} finished={finished} />

      {!finished && !o.isOvertime && (
        <div className="lf-card p-4 text-sm" data-testid="tracking-policy">
          <p className="flex items-center gap-2 font-semibold text-navy dark:text-dk-texthi">
            <Clock size={16} className="text-brand" /> {t('tracking.policyTitle')}
          </p>
          <p className="mt-1 text-muted">
            <Trans
              i18nKey={o.hourlyRate > 0 ? 'ui:tracking.policyRate' : 'ui:tracking.policy'}
              values={{ minutes: o.gracePeriodMin, rate: o.hourlyRate, currency: data.currency }}
              components={{ 1: <strong /> }}
            />
          </p>
        </div>
      )}

      <div className="lf-card p-4">
        <p className="mb-3 text-sm font-semibold text-navy dark:text-dk-texthi">
          {t('tracking.items', { count: data.bagCount })}
        </p>
        <ul className="flex flex-col gap-2" data-testid="tracking-bags">
          {data.bags.map((b) => (
            <li key={b.index} className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2 text-sm dark:bg-dk-elevated">
              <span className="text-navy dark:text-dk-text">{t('tracking.item', { index: b.index, description: b.description })}</span>
              <span className="text-xs font-medium text-muted">
                {t(`status:bag.${b.status}`, { defaultValue: b.status.replaceAll('_', ' ') })}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="pb-4 text-center text-xs text-muted">{t('tracking.showAtCounter')}</p>
    </div>
  )
}

function CountdownCard({
  data,
  msToDue,
  msToPenalty,
  finished,
}: {
  data: PublicTracking
  msToDue: number | null
  msToPenalty: number | null
  finished: boolean
}) {
  const { t } = useTranslation('ui')
  const o = data.overtime
  const currency = data.currency

  if (finished) {
    return (
      <section className="lf-card border-success/50 bg-emerald-50 p-6 text-center dark:bg-emerald-900/20" data-testid="tracking-finished">
        <CheckCircle2 className="mx-auto mb-2 text-success" size={30} />
        <h2 className="text-lg font-bold text-success">
          {data.status === 'COMPLETED' ? t('tracking.collected') : t('tracking.cancelled')}
        </h2>
        {o.penaltyAmount > 0 && (
          <p className="mt-2 text-sm text-navy dark:text-dk-text" data-testid="tracking-final-penalty">
            {t('tracking.finalPenalty', { amount: o.penaltyAmount.toFixed(2), currency, hours: o.chargeableHours })}
          </p>
        )}
      </section>
    )
  }

  if (o.phase === 'NOT_STARTED') {
    return (
      <section className="lf-card p-6 text-center" data-testid="tracking-not-started">
        <Clock className="mx-auto mb-2 text-muted" size={28} />
        <h2 className="text-lg font-bold text-navy dark:text-dk-texthi">{t('tracking.notStarted')}</h2>
        <p className="mt-1 text-sm text-muted">{t('tracking.notStartedHint')}</p>
      </section>
    )
  }

  if (o.isOvertime) {
    return (
      <section className="lf-card border-danger-strong/50 bg-red-50 p-6 text-center dark:bg-red-900/20" data-testid="tracking-overtime">
        <ShieldAlert className="mx-auto mb-2 text-danger-strong" size={30} />
        <h2 className="text-lg font-bold text-danger-strong">{t('tracking.overtime')}</h2>
        <p className="mt-1 text-sm text-muted">{t('tracking.pastBy', { duration: humanizeRemaining(o.overdueMs) })}</p>
        <div className="mt-4 rounded-xl bg-white/70 px-4 py-3 dark:bg-black/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('tracking.penaltySoFar')}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-danger-strong" data-testid="tracking-penalty">
            {o.penaltyAmount.toFixed(2)} <span className="text-lg">{currency}</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            {t('tracking.blocks', { count: o.chargeableHours })}
            {o.hourlyRate > 0 && <> {t('tracking.atRate', { rate: o.hourlyRate, currency })}</>}
          </p>
        </div>
        <p className="mt-3 text-xs text-muted">{t('tracking.collectNow')}</p>
      </section>
    )
  }

  if (o.withinGrace) {
    return (
      <section className="lf-card border-amber-400/60 bg-amber-50 p-6 text-center dark:bg-amber-900/20" data-testid="tracking-grace">
        <TriangleAlert className="mx-auto mb-2 text-amber-600 dark:text-amber-300" size={30} />
        <h2 className="text-lg font-bold text-amber-700 dark:text-amber-300">{t('tracking.grace')}</h2>
        <p className="mt-1 text-sm text-muted">{t('tracking.graceHint')}</p>
        <p className="mt-3 text-4xl font-bold tabular-nums text-amber-700 dark:text-amber-300" data-testid="tracking-countdown">
          {humanizeRemaining(Math.max(0, msToPenalty ?? 0))}
        </p>
        <p className="mt-1 text-xs text-muted">
          {o.hourlyRate > 0
            ? t('tracking.untilChargedRate', { rate: o.hourlyRate, currency })
            : t('tracking.untilCharged')}
        </p>
      </section>
    )
  }

  const soon = msToDue != null && msToDue < 15 * 60_000
  return (
    <section
      className={clsx('lf-card p-6 text-center', soon ? 'border-amber-400/60 bg-amber-50 dark:bg-amber-900/20' : '')}
      data-testid="tracking-running"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('tracking.timeRemaining')}</p>
      <p
        className={clsx('mt-2 text-5xl font-bold tabular-nums', soon ? 'text-amber-700 dark:text-amber-300' : 'text-success')}
        data-testid="tracking-countdown"
      >
        {humanizeRemaining(Math.max(0, msToDue ?? 0))}
      </p>
      {soon && (
        <p className="mt-3 text-sm font-medium text-amber-700 dark:text-amber-300" data-testid="tracking-ending-soon">
          {t('tracking.nearlyUp')}
        </p>
      )}
    </section>
  )
}
