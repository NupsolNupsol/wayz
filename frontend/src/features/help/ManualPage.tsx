import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { ArrowUpRight, Ban, Lightbulb, Search } from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/PageHeader'
import { Card, SectionTitle } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { MANUAL_GROUPS } from '@/config/manual'
import { APP } from '@/config/appConfig'

interface ManualStep {
  title: string
  detail: string
}

interface ReadableSection {
  id: string
  route?: string
  icon: string
  title: string
  summary: string
  steps: ManualStep[]
  rules: string[]
  tips: string[]
}

export function ManualPage() {
  const { t } = useTranslation(['manual', 'common'])
  const { hash } = useLocation()
  const [query, setQuery] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const scrolledFor = useRef<string | null>(null)

  const term = query.trim().toLowerCase()
  const groups = MANUAL_GROUPS.map((g) => ({
    id: g.id,
    label: t(`group.${g.id}`),
    sections: g.sections
      .map((s): ReadableSection => ({
        id: s.id,
        route: s.route,
        icon: s.icon,
        title: t(`section.${s.id}.title`),
        summary: t(`section.${s.id}.summary`),
        steps: s.steps ? (t(`section.${s.id}.steps`, { returnObjects: true }) as ManualStep[]) : [],
        rules: s.rules ? (t(`section.${s.id}.rules`, { returnObjects: true }) as string[]) : [],
        tips: s.tips ? (t(`section.${s.id}.tips`, { returnObjects: true }) as string[]) : [],
      }))
      .filter((s) =>
        !term
          ? true
          : [s.title, s.summary, ...s.steps.flatMap((x) => [x.title, x.detail]), ...s.rules, ...s.tips]
              .join(' ')
              .toLowerCase()
              .includes(term),
      ),
  })).filter((g) => g.sections.length > 0)

  useEffect(() => {
    const id = hash.replace('#', '')
    if (!id || scrolledFor.current === id) return
    const el = document.getElementById(id)
    if (!el) return
    scrolledFor.current = id
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setFlash(id)
    const t = setTimeout(() => setFlash(null), 2200)
    return () => clearTimeout(t)
  }, [hash, groups.length])

  const visibleIds = groups.flatMap((g) => g.sections.map((s) => s.id)).join(',')
  useEffect(() => {
    const ids = visibleIds ? visibleIds.split(',') : []
    if (!ids.length) return

    const READING_LINE = 140
    let frame = 0

    const update = () => {
      frame = 0

      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      if (atBottom) {
        setActive(ids[ids.length - 1])
        return
      }

      let current = ids[0]
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= READING_LINE) current = id
      }
      setActive(current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [visibleIds])

  return (
    <div data-testid="manual-page">
      <PageHeader
        title={t('page.title')}
        subtitle={t('page.subtitle', { app: APP.name, product: APP.product })}
        crumbs={[{ label: t('common:crumb.home'), to: '/dashboard' }, { label: t('common:crumb.help') }, { label: t('common:crumb.usermanual') }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5 items-start">
        <Card className="order-first lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] flex flex-col !p-4">
          <div className="relative shrink-0">
            <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="lf-input ps-9 !h-9 text-sm"
              placeholder={t('page.search')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-testid="manual-search"
            />
          </div>
          <nav className="flex-1 overflow-y-auto scroll-thin -mx-1 px-1 mt-3" aria-label={t('page.contents')}>
            {groups.map((g, gi) => (
              <div key={g.id} className={clsx(gi > 0 && 'mt-4 pt-4 border-t border-line')}>
                <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted/70">
                  {g.label}
                </p>
                {g.sections.map((s) => {
                  const isActive = active === s.id
                  return (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      aria-current={isActive ? 'true' : undefined}
                      data-testid={`manual-toc-${s.id}`}
                      data-active={isActive}
                      className={clsx(
                        'relative block px-2.5 py-2 rounded-lg text-[13.5px] leading-snug no-underline transition-colors',
                        isActive
                          ? 'bg-brand/10 text-brand font-semibold'
                          : 'text-navy dark:text-dk-texthi font-medium hover:bg-canvas dark:hover:bg-dk-elevated',
                      )}
                    >
                      {isActive && <span className="absolute start-0 top-2 bottom-2 w-[3px] rounded-e bg-brand" />}
                      {s.title}
                    </a>
                  )
                })}
              </div>
            ))}
            {groups.length === 0 && <p className="text-sm text-muted px-2">{t('page.noMatch', { query })}</p>}
          </nav>
        </Card>

        <div className="flex flex-col gap-5 min-w-0">
          {groups.map((g) => (
            <section key={g.id}>
              <h2 className="flex items-center gap-3 mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted/70">
                <span>{g.label}</span>
                <span className="h-px flex-1 bg-line" />
              </h2>
              <div className="flex flex-col gap-4">
                {g.sections.map((s) => (
                  <ManualCard key={s.id} section={s} highlighted={flash === s.id} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

function ManualCard({ section, highlighted }: { section: ReadableSection; highlighted: boolean }) {
  const { t } = useTranslation('manual')
  return (
    <Card
      id={section.id}
      data-testid={`manual-section-${section.id}`}
      className={clsx('scroll-mt-24 transition-shadow', highlighted && 'ring-2 ring-brand shadow-pop')}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
            <Icon name={section.icon} size={20} />
          </div>
          <div className="min-w-0">
            <SectionTitle>{section.title}</SectionTitle>
            <p className="text-sm text-muted mt-0.5">{section.summary}</p>
          </div>
        </div>
        {section.route && (
          <Link to={section.route} className="lf-btn-secondary !h-8 !px-2.5 text-xs shrink-0 no-underline">
            {t('page.open')} <ArrowUpRight size={13} />
          </Link>
        )}
      </div>

      {section.steps.length > 0 && (
        <ol className="mt-3 flex flex-col gap-2.5">
          {section.steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-canvas dark:bg-dk-elevated text-xs font-bold text-navy dark:text-dk-text flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy dark:text-dk-texthi">{step.title}</p>
                <p className="text-sm text-muted">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {section.rules.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-300/70 bg-amber-50 dark:bg-amber-900/20 p-3">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            <Ban size={14} /> {t('page.willStopYou')}
          </p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {section.rules.map((r, i) => (
              <li key={i} className="text-sm text-navy dark:text-dk-text">• {r}</li>
            ))}
          </ul>
        </div>
      )}

      {section.tips.length > 0 && (
        <div className="mt-3 rounded-xl bg-canvas dark:bg-dk-elevated p-3">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
            <Lightbulb size={14} /> {t('page.goodToKnow')}
          </p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {section.tips.map((tip, i) => (
              <li key={i} className="text-sm text-muted">• {tip}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
