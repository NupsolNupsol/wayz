import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Ban, CalendarRange, ChevronRight, Plus, Receipt, TriangleAlert, Users, Wallet } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, Field, SectionTitle, Spinner, StatCard } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { Select } from '@/components/Select'
import {
  useCreateExpense,
  useCreateSeason,
  useHrExpenses,
  useHrOverview,
  useHrSeasons,
  useVoidExpense,
} from '@/hooks'
import { ENTERABLE_CATEGORIES, EXPENSE_CATEGORIES, SYSTEM_CATEGORIES, categoryLabel, type Expense, type ExpenseCategory } from '@/api/hr.api'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { engineLabel } from '@/config/engineMeta'
import { money } from '@/utils'
import type { EngineKind } from '@/api/types'

const ACTIVITY_OPTIONS = [
  { labelKey: 'common:label.notactivityspecific', value: '' },
  { labelKey: 'common:engine.LAGOON', value: 'LAGOON' },
  { labelKey: 'common:engine.MOBILITY', value: 'MOBILITY' },
  { labelKey: 'common:engine.SHOP_AND_DROP', value: 'SHOP_AND_DROP' },
]

export function HrCosts() {
  const { t } = useTranslation(['hr', 'common'])
  const { data: overview, isLoading } = useHrOverview()
  const { data: rows = [] } = useHrExpenses()
  const { data: seasons = [] } = useHrSeasons()
  const createExpense = useCreateExpense()
  const voidExpense = useVoidExpense()

  const [adding, setAdding] = useState(false)
  const [voiding, setVoiding] = useState<Expense | null>(null)
  const [reason, setReason] = useState('')
  const [form, setForm] = useState<Record<string, string>>({})

  const openAdd = () => {
    setForm({
      category: 'SUPPLIER',
      description: '',
      supplier: '',
      reference: '',
      engineKind: '',
      seasonId: seasons[0]?._id ?? '',
      amount: '',
      incurredAt: new Date().toISOString().slice(0, 10),
    })
    setAdding(true)
  }

  const submit = () => {
    createExpense.mutate(
      {
        category: form.category as ExpenseCategory,
        description: form.description,
        supplier: form.supplier || undefined,
        reference: form.reference || undefined,
        engineKind: (form.engineKind || null) as EngineKind | null,
        seasonId: form.seasonId || null,
        amount: Number(form.amount || 0),
        incurredAt: form.incurredAt,
      },
      {
        onSuccess: () => {
          toast('success', t('costs.costRecorded'), t('costs.nowCounts'))
          setAdding(false)
        },
        onError: (e) => toast('danger', t('costs.notRecorded'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  const submitVoid = () => {
    if (!voiding) return
    voidExpense.mutate(
      { id: voiding._id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast('warning', t('costs.costVoided'), t('costs.noLongerCounts'))
          setVoiding(null)
          setReason('')
        },
        onError: (e) => toast('danger', t('costs.couldNotVoid'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  if (isLoading || !overview) {
    return (
      <div data-testid="hr-costs">
        <PageHeader title={t('costs.title')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  const ready = (form.description ?? '').trim().length >= 3 && Number(form.amount) > 0

  const activityOptions = [...new Set(rows.map((r) => r.engineKind).filter(Boolean))].map((kind) => ({
    label: engineLabel(kind as EngineKind),
    value: String(kind),
  }))

  return (
    <div data-testid="hr-costs">
      <PageHeader
        title={t('costs.title')}
        subtitle={t('costs.subtitle')}
        crumbs={[{ label: t('common:crumb.hr') }, { label: t('common:crumb.costs') }]}
        helpId="hr-costs"
        actions={
          <Button onClick={openAdd} data-testid="hr-add-cost">
            <Plus size={16} />{t('costs.record')}</Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-5">
        <StatCard label={t('costs.recorded')} value={overview.totals.count} icon={<Receipt size={18} />} tone="neutral" testId="hr-stat-count" />
        <StatCard label={t('costs.totalExVat')} value={money(overview.totals.base)} icon={<Wallet size={18} />} tone="info" testId="hr-stat-base" />
        <StatCard label={t('costs.recoverableVat')} value={money(overview.totals.vat)} icon={<Receipt size={18} />} tone="success" testId="hr-stat-vat" />
        <StatCard
          label={t('costs.notTiedToActivity')}
          value={money(overview.unassigned.base)}
          icon={<Users size={18} />}
          tone={overview.unassigned.count ? 'warning' : 'neutral'}
          sublabel={t('costs.entryCount', { count: overview.unassigned.count })}
          testId="hr-stat-unassigned"
        />
      </div>

      <SectionTitle className="mb-2">{t('costs.byCategory')}</SectionTitle>
      <Card className="p-4 mb-6" data-testid="hr-by-category">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-8">
          {overview.byCategory.map((c) => {
            const share = overview.totals.base > 0 ? (c.base / overview.totals.base) * 100 : 0
            return (
              <div
                key={c.category}
                className="flex items-baseline justify-between gap-3 py-1.5 border-b border-line/70 dark:border-dk-border/70"
              >
                <span className="text-sm text-navy dark:text-dk-text truncate">
                  {categoryLabel(c.category)}
                  <span className="text-[11px] text-muted ms-1.5">{c.count}</span>
                </span>
                <span className="shrink-0 text-end">
                  <span className="tabular-nums text-sm font-semibold">
                    {c.base.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-[11px] text-muted ms-1.5 tabular-nums">{share.toFixed(0)}%</span>
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      <SectionTitle className="mb-2">{t('costs.allCosts')}</SectionTitle>
      <DataTable
        testId="hr-costs-table"
        rows={rows}
        keyOf={(r: Expense) => r._id}
        pageSize={15}
        initialSort={{ key: 'when', dir: 'desc' }}
        empty={{ title: t('costs.noCosts'), message: t('costs.noCostsHint') }}
        columns={[
          {
            key: 'what',
            header: t('common:column.cost'),
            sortValue: (r: Expense) => r.description,
            filter: { kind: 'text', value: (r: Expense) => `${r.description} ${r.supplier} ${r.reference}` },
            render: (r: Expense) => (
              <div className="max-w-[280px]">
                <p className="text-sm font-semibold text-navy dark:text-dk-texthi truncate">{r.description}</p>
                <p className="text-[11px] text-muted">{r.supplier || '—'} · {r.reference || t('common:label.noReference')}</p>
              </div>
            ),
          },
          {
            key: 'category',
            header: t('common:column.category'),
            filter: {
              kind: 'select',
              options: EXPENSE_CATEGORIES.map((c) => ({ label: categoryLabel(c), value: c })),
              value: (r: Expense) => r.category,
            },
            render: (r: Expense) => <Badge tone="neutral">{categoryLabel(r.category)}</Badge>,
          },
          {
            key: 'activity',
            header: t('common:column.activity'),
            sortValue: (r: Expense) => (r.engineKind ? (engineLabel(r.engineKind)) : ''),
            filter: {
              kind: 'select',
              options: [
                { label: t('common:label.notactivityspecific'), value: '' },
                ...activityOptions,
              ],
              value: (r: Expense) => r.engineKind ?? '',
            },
            render: (r: Expense) =>
              r.engineKind ? (engineLabel(r.engineKind)) : <span className="text-muted">—</span>,
          },
          {
            key: 'season',
            header: t('common:column.season'),
            sortValue: (r: Expense) => r.seasonName ?? '',
            filter: {
              kind: 'select',
              options: [
                { label: t('common:label.noseason'), value: '' },
                ...seasons.map((s) => ({ label: s.name, value: s.name })),
              ],
              value: (r: Expense) => r.seasonName ?? '',
            },
            render: (r: Expense) => <span className="text-sm">{r.seasonName ?? '—'}</span>,
          },
          {
            key: 'base',
            header: t('common:column.exvat'),
            align: 'right',
            sortValue: (r: Expense) => r.baseAmount,
            render: (r: Expense) => <span className="tabular-nums">{r.baseAmount.toFixed(2)}</span>,
          },
          {
            key: 'vat',
            header: t('common:column.vat'),
            align: 'right',
            render: (r: Expense) => <span className="tabular-nums text-muted">{r.vatAmount.toFixed(2)}</span>,
          },
          {
            key: 'total',
            header: t('common:column.total'),
            align: 'right',
            sortValue: (r: Expense) => r.amount,
            render: (r: Expense) => <strong className="tabular-nums">{r.amount.toFixed(2)}</strong>,
          },
          {
            key: 'when',
            header: t('common:column.incurred'),
            align: 'right',
            sortValue: (r: Expense) => r.incurredAt,
            render: (r: Expense) => <span className="text-xs text-muted">{new Date(r.incurredAt).toISOString().slice(0, 10)}</span>,
          },
          {
            key: 'status',
            header: '',
            align: 'right',
            render: (r: Expense) =>
              r.status === 'VOID' ? (
                <Badge tone="neutral">{t('costs.void')}</Badge>
              ) : SYSTEM_CATEGORIES.includes(r.category) ? (
                <span className="text-xs text-muted" title={t('costs.fromCards')}>{t('common:label.automatic')}</span>
              ) : (
                <Button variant="ghost" onClick={(e) => { e.stopPropagation(); setVoiding(r); setReason('') }} data-testid={`hr-void-${r._id}`}>
                  <Ban size={15} /> {t('costs.void')}
                </Button>
              ),
          },
        ]}
      />

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title={t('costs.record')}
        subtitle={t('costs.recordHint')}
        size="lg"
        testId="hr-cost-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>{t('common:action.cancel')}</Button>
            <Button onClick={submit} loading={createExpense.isPending} disabled={!ready} data-testid="hr-cost-submit">{t('costs.recordCost')}</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label={t('costs.category')} required>
            <Select
              value={form.category ?? 'SUPPLIER'}
              onChange={(v) => setForm({ ...form, category: v })}
              options={ENTERABLE_CATEGORIES.map((c) => ({ label: categoryLabel(c), value: c }))}
              testId="hr-cost-category"
            />
          </Field>
          <Field label={t('costs.amountInclVat')} required hint={t('costs.payrollNoVat')}>
            <input
              type="number"
              min={0}
              step="0.01"
              className="lf-input tabular-nums"
              value={form.amount ?? ''}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              data-testid="hr-cost-amount"
            />
          </Field>
        </div>

        <Field label={t('common:field.description')} required>
          <input
            className="lf-input"
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={t('costs.descriptionPlaceholder')}
            data-testid="hr-cost-description"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label={t('costs.supplier')}>
            <input className="lf-input" value={form.supplier ?? ''} onChange={(e) => setForm({ ...form, supplier: e.target.value })} data-testid="hr-cost-supplier" />
          </Field>
          <Field label={t('costs.invoiceReference')}>
            <input className="lf-input" value={form.reference ?? ''} onChange={(e) => setForm({ ...form, reference: e.target.value })} data-testid="hr-cost-reference" />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
          <Field label={t('common:field.activity')} hint={t('costs.blankShared')}>
            <Select
              value={form.engineKind ?? ''}
              onChange={(v) => setForm({ ...form, engineKind: v })}
              options={ACTIVITY_OPTIONS.map((o) => ({ label: t(o.labelKey), value: o.value }))}
              testId="hr-cost-activity"
            />
          </Field>
          <Field label={t('costs.season')}>
            <Select
              value={form.seasonId ?? ''}
              onChange={(v) => setForm({ ...form, seasonId: v })}
              options={[{ label: t('common:label.noseason'), value: '' }, ...seasons.map((s) => ({ label: s.name, value: s._id }))]}
              testId="hr-cost-season"
            />
          </Field>
          <Field label={t('costs.dateIncurred')}>
            <input type="date" className="lf-input" value={form.incurredAt ?? ''} onChange={(e) => setForm({ ...form, incurredAt: e.target.value })} data-testid="hr-cost-date" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!voiding}
        onClose={() => { setVoiding(null); setReason('') }}
        title={t('costs.void')}
        subtitle={t('costs.voidHint')}
        testId="hr-void-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setVoiding(null); setReason('') }}>{t('common:action.cancel')}</Button>
            <Button variant="danger" onClick={submitVoid} loading={voidExpense.isPending} disabled={reason.trim().length < 3} data-testid="hr-void-submit">
              {t('costs.void')}
            </Button>
          </>
        }
      >
        <Field label={t('common:field.reason')} required>
          <textarea className="lf-input min-h-[80px]" value={reason} onChange={(e) => setReason(e.target.value)} data-testid="hr-void-reason" />
        </Field>
      </Modal>
    </div>
  )
}

export function HrSeasons() {
  const { t } = useTranslation(['hr', 'common'])
  const navigate = useNavigate()
  const { data: seasons = [], isLoading } = useHrSeasons()
  const createSeason = useCreateSeason()

  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 10))
  const [endsAt, setEndsAt] = useState('')

  /**
   * Six months on, in whole months. Naive month arithmetic rolls 31 August over into
   * 2 March, and reading the date back in a local timezone can shift it by a day, so
   * this stays in UTC and clamps to the last day of the target month.
   */
  const defaultEnd = (start: string) => {
    const [year, month, day] = start.split('-').map(Number)
    if (!year || !month || !day) return ''
    const target = new Date(Date.UTC(year, month - 1 + 6, 1))
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
    target.setUTCDate(Math.min(day, lastDay))
    return target.toISOString().slice(0, 10)
  }

  const submitSeason = () => {
    createSeason.mutate(
      { name, startsAt, endsAt: endsAt || defaultEnd(startsAt) },
      {
        onSuccess: (season) => {
          toast('success', t('costs.seasonCreated'), t('costs.chargeNext'))
          setAdding(false)
          setName('')
          navigate(`/hr/seasons/${season._id}`)
        },
        onError: (e) => toast('danger', t('costs.couldNotCreate'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  if (isLoading) {
    return (
      <div data-testid="hr-seasons">
        <PageHeader title={t('costs.seasons')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  return (
    <div data-testid="hr-seasons">
      <PageHeader
        title={t('costs.seasons')}
        subtitle={t('costs.seasonsSubtitle')}
        crumbs={[{ label: t('common:crumb.hr') }, { label: t('common:crumb.seasons') }]}
        helpId="hr-seasons"
        actions={
          <Button onClick={() => { setAdding(true); setEndsAt(defaultEnd(startsAt)) }} data-testid="hr-add-season">
            <Plus size={16} />{t('costs.newSeason')}</Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="hr-season-list">
        {seasons.map((s) => (
          <Card
            key={s._id}
            role="button"
            tabIndex={0}
            className="p-4 lf-card-hover cursor-pointer focus:outline-none focus:ring-[3px] focus:ring-brand/25"
            onClick={() => navigate(`/hr/seasons/${s._id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                navigate(`/hr/seasons/${s._id}`)
              }
            }}
            data-testid={`hr-season-${s._id}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-navy dark:text-dk-texthi flex items-center gap-2">
                  <CalendarRange size={16} className="text-brand shrink-0" /> <span className="truncate">{s.name}</span>
                </p>
                <p className="text-xs text-muted mt-1">
                  {new Date(s.startsAt).toISOString().slice(0, 10)} → {new Date(s.endsAt).toISOString().slice(0, 10)}
                </p>
              </div>
              <ChevronRight size={18} className="text-muted shrink-0" />
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-sm">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted font-semibold">{t('costs.costBase')}</p>
                <p className="tabular-nums font-semibold text-navy dark:text-dk-texthi">{money(s.expenseBase)}</p>
                <p className="text-[11px] text-muted">{t('costs.entryCount', { count: s.expenseCount })}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted font-semibold">{t('costs.employeeCharges')}</p>
                <p className="tabular-nums font-semibold text-navy dark:text-dk-texthi">{money(s.payrollBase)}</p>
                <p className="text-[11px] text-muted">{t('costs.chargedCount', { count: s.payrollCount })}</p>
              </div>
            </div>

            {s.payrollCount === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-300 mt-3 flex items-center gap-1.5">
                <TriangleAlert size={13} />{t('costs.noCharges')}</p>
            )}
          </Card>
        ))}
      </div>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title={t('costs.newSeason')}
        subtitle={t('costs.seasonHint')}
        testId="hr-season-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>{t('common:action.cancel')}</Button>
            <Button onClick={submitSeason} loading={createSeason.isPending} disabled={name.trim().length < 2} data-testid="hr-season-submit">
              Create
            </Button>
          </>
        }
      >
        <Field label={t('common:field.name')} required>
          <input className="lf-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('costs.seasonPlaceholder')} data-testid="hr-season-name" />
        </Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label={t('costs.starts')} required>
            <input type="date" className="lf-input" value={startsAt} onChange={(e) => { setStartsAt(e.target.value); setEndsAt(defaultEnd(e.target.value)) }} data-testid="hr-season-start" />
          </Field>
          <Field label={t('costs.ends')} required hint={t('costs.defaultsSixMonths')}>
            <input type="date" className="lf-input" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} data-testid="hr-season-end" />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
