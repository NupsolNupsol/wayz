import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, EmptyState } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { useAuthStore } from '@/store/auth'
import { ENGINE_META, engineTagline, enginesFor } from '@/config/engineMeta'
import { activityApi, type PublishedActivity } from '@/api/activity.api'
import { usePageContext, PAGE_KEYS } from '@/features/assistant/pageContext'

/**
 * What this person can sell, from both halves of the platform.
 *
 * The built-in engines, for a company that runs them, and the company's own published
 * activities, for a company that defined them. Most companies will have only one of the two,
 * and this screen used to render only the first — so an agent at a company with no built-in
 * engines was shown an empty grid and had no way to do their job at all.
 */

export function PosPage() {
  usePageContext({
    pageKey: PAGE_KEYS.pos,
    module: 'POS',
    screenTitle: 'معاملة جديدة',
  })

  const { t } = useTranslation(['agent', 'common'])
  const navigate = useNavigate()
  const me = useAuthStore((s) => s.me)
  const enabled = me?.tenant?.enabledEngines ?? []
  const engines = enginesFor(me?.engineKinds ?? []).filter((k) => enabled.includes(k))

  /*
   * The company's own activities, narrowed to the ones this person was actually assigned.
   *
   * The server already refuses anything else at the moment of sale; this keeps the screen from
   * offering a tile that would be refused, which is a worse experience than not offering it.
   */
  const assigned = me?.activityKeys ?? []
  const [activities, setActivities] = useState<PublishedActivity[]>([])

  useEffect(() => {
    activityApi
      .published()
      .then((rows) => setActivities(assigned.length ? rows.filter((a) => assigned.includes(a.key)) : rows))
      .catch(() => setActivities([]))
    // The assignment list is fixed for the session; it changes only on sign-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assigned.join(',')])

  return (
    <div data-testid="pos-page">
      <PageHeader helpId="pos" title={t('pos.title')} subtitle={t('pos.subtitle')} crumbs={[{ label: t('pos.home'), to: '/dashboard' }, { label: t('pos.title') }]} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {activities.map((activity) => (
          <button
            key={activity.key}
            onClick={() => navigate(`/activities/${activity.key}`)}
            data-testid={`activity-${activity.key}`}
            className="text-start"
          >
            <Card className="lf-card-hover h-full">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-brand text-brand-fg flex items-center justify-center shrink-0 text-xl">
                  {activity.emoji || <Icon name="Blocks" size={22} />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-navy dark:text-dk-texthi">{activity.name}</h3>
                  <p className="text-sm text-muted mt-0.5 line-clamp-2">{activity.description}</p>
                </div>
                <ArrowRight size={18} className="text-muted mt-1" />
              </div>
            </Card>
          </button>
        ))}

        {engines.map((kind) => {
          const m = ENGINE_META[kind]
          return (
            <button key={kind} onClick={() => navigate(m.route)} data-testid={`engine-${kind}`} className="text-start">
              <Card className="lf-card-hover h-full">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-brand text-brand-fg flex items-center justify-center shrink-0"><Icon name={m.icon} size={22} /></div>
                  <div className="flex-1">
                    <h3 className="font-bold text-navy dark:text-dk-texthi">{t(`common:engine.${kind}`)}</h3>
                    <p className="text-sm text-muted mt-0.5">{engineTagline(kind)}</p>
                  </div>
                  <ArrowRight size={18} className="text-muted mt-1" />
                </div>
              </Card>
            </button>
          )
        })}
      </div>

      {engines.length === 0 && activities.length === 0 && (
        <EmptyState
          title="Nothing is assigned to you yet"
          message="Your manager decides which of the company's activities you work. Once one is assigned, it appears here."
        />
      )}
    </div>
  )
}
