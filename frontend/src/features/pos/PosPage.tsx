import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { useAuthStore } from '@/store/auth'
import { ENGINE_META, engineTagline, enginesFor } from '@/config/engineMeta'

export function PosPage() {
  const { t } = useTranslation(['agent', 'common'])
  const navigate = useNavigate()
  const me = useAuthStore((s) => s.me)
  const enabled = me?.tenant?.enabledEngines ?? []
  const engines = enginesFor(me?.engineKinds ?? []).filter((k) => enabled.includes(k))

  return (
    <div data-testid="pos-page">
      <PageHeader helpId="pos" title={t('pos.title')} subtitle={t('pos.subtitle')} crumbs={[{ label: t('pos.home'), to: '/dashboard' }, { label: t('pos.title') }]} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
    </div>
  )
}
