import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, RotateCcw, Save, Timer, Trash2, TriangleAlert } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button, Card, Field, FieldGroupTitle, SectionTitle, Spinner } from '@/components/ui'
import { Select } from '@/components/Select'
import { NumberInput } from '@/components/NumberInput'
import { PenaltyAmount } from './PenaltyAmount'
import { useTenantRules, useUpdateRules } from '@/hooks'
import { engineLabel, visibleEngineOptions } from '@/config/engineMeta'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import type { EngineKind } from '@/api/types'
import type { PenaltyRule, RentalRules, TimerRule } from '@/api/rules.api'

const emptyPenalty = (): PenaltyRule => ({ code: '', label: '', amount: 0, engineKind: null })

export function AdminRules() {
  const { t } = useTranslation(['admin', 'common'])
  const { data, isLoading } = useTenantRules()
  const update = useUpdateRules()

  const [rental, setRental] = useState<RentalRules | null>(null)
  const [penalties, setPenalties] = useState<PenaltyRule[]>([])

  useEffect(() => {
    if (!data) return
    setRental(structuredClone(data.rental))
    setPenalties(structuredClone(data.penalties))
  }, [data])

  if (isLoading || !data || !rental) {
    return (
      <div data-testid="admin-rules">
        <PageHeader title={t('rules.title')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  const setTimer = (engine: EngineKind, patch: Partial<TimerRule>) =>
    setRental((prev) =>
      prev ? { ...prev, timers: { ...prev.timers, [engine]: { ...prev.timers[engine], ...patch } } } : prev,
    )

  const setPenalty = (index: number, patch: Partial<PenaltyRule>) =>
    setPenalties((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  const graceMismatch = rental.statedGraceMin > rental.graceMin
  const incomplete = penalties.some((p) => !p.code.trim() || !p.label.trim())

  const save = () => {
    update.mutate(
      { rental, penalties },
      {
        onSuccess: () => toast('success', t('rules.saved'), t('rules.savedDetail')),
        onError: (e) =>
          toast('danger', t('common:error.couldNotSave'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  const reset = () => {
    setRental(structuredClone(data.defaults.rental))
    setPenalties(structuredClone(data.defaults.penalties))
    toast('info', t('rules.reset'), t('rules.resetDetail'))
  }

  const activities = visibleEngineOptions().filter((o) => data.engineKinds.includes(o.value))

  return (
    <div data-testid="admin-rules">
      <PageHeader
        title={t('rules.title')}
        subtitle={t('rules.subtitle')}
        crumbs={[{ label: t('common:crumb.admin') }, { label: t('rules.title') }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={reset} data-testid="rules-reset">
              <RotateCcw size={16} />
              {t('rules.restoreDefaults')}
            </Button>
            <Button
              onClick={save}
              loading={update.isPending}
              disabled={graceMismatch || incomplete}
              data-testid="rules-save"
            >
              <Save size={16} />
              {t('common:action.save')}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <SectionTitle>{t('rules.clock.title')}</SectionTitle>
          <p className="text-sm text-muted mb-4">{t('rules.clock.blurb')}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Field
              label={t('rules.clock.graceMin')}
              hint={t('rules.clock.graceHint')}
              error={graceMismatch ? t('rules.clock.graceMismatch') : undefined}
            >
              <NumberInput
                value={rental.graceMin}
                onChange={(v) => setRental({ ...rental, graceMin: v })}
                min={0}
                testId="rules-grace"
              />
            </Field>
            <Field label={t('rules.clock.statedGraceMin')} hint={t('rules.clock.statedGraceHint')}>
              <NumberInput
                value={rental.statedGraceMin}
                onChange={(v) => setRental({ ...rental, statedGraceMin: v })}
                min={0}
                testId="rules-stated-grace"
              />
            </Field>
            <Field label={t('rules.clock.overtimeBlockMin')} hint={t('rules.clock.overtimeBlockHint')}>
              <NumberInput
                value={rental.overtimeBlockMin}
                onChange={(v) => setRental({ ...rental, overtimeBlockMin: v })}
                min={1}
                testId="rules-block"
              />
            </Field>
            <Field label={t('rules.clock.replacementBonusMin')} hint={t('rules.clock.replacementHint')}>
              <NumberInput
                value={rental.replacementBonusMin}
                onChange={(v) => setRental({ ...rental, replacementBonusMin: v })}
                min={0}
                testId="rules-replacement"
              />
            </Field>
          </div>

          <Field label={t('rules.clock.wrongStationPenalty')} hint={t('rules.clock.wrongStationHint')}>
            <NumberInput
              value={rental.wrongStationPenalty}
              onChange={(v) => setRental({ ...rental, wrongStationPenalty: v })}
              min={0}
              testId="rules-wrong-station"
            />
          </Field>
        </Card>

        <Card>
          <SectionTitle>{t('rules.timers.title')}</SectionTitle>
          <p className="text-sm text-muted mb-4">{t('rules.timers.blurb')}</p>

          <div className="flex flex-col gap-3" data-testid="rules-timers">
            {activities.map((activity) => {
              const timer = rental.timers[activity.value]
              return (
                <div
                  key={activity.value}
                  className="rounded-xl2 border border-line dark:border-dk-line p-3"
                  data-testid={`rules-timer-${activity.value}`}
                >
                  <FieldGroupTitle>
                    <Timer size={14} />
                    {engineLabel(activity.value)}
                  </FieldGroupTitle>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    <Field label={t('rules.timers.startsOn')}>
                      <Select
                        value={timer.startsOn}
                        onChange={(v) => setTimer(activity.value, { startsOn: v as TimerRule['startsOn'] })}
                        options={[
                          { label: t('rules.timers.onFulfilment'), value: 'FULFILMENT' },
                          { label: t('rules.timers.onPayment'), value: 'PAYMENT' },
                        ]}
                        testId={`rules-timer-start-${activity.value}`}
                      />
                    </Field>
                    <Field label={t('rules.timers.startDelayMin')} hint={t('rules.timers.startDelayHint')}>
                      <NumberInput
                        value={timer.startDelayMin}
                        onChange={(v) => setTimer(activity.value, { startDelayMin: v })}
                        min={0}
                        testId={`rules-timer-delay-${activity.value}`}
                      />
                    </Field>
                  </div>
                  <p className="text-xs text-muted">
                    {timer.startsOn === 'PAYMENT'
                      ? t('rules.timers.explainPayment', { minutes: timer.startDelayMin })
                      : t('rules.timers.explainFulfilment')}
                  </p>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <SectionTitle>{t('rules.penalties.title')}</SectionTitle>
            <p className="text-sm text-muted">{t('rules.penalties.blurb')}</p>
          </div>
          <Button variant="secondary" onClick={() => setPenalties([...penalties, emptyPenalty()])} data-testid="rules-penalty-add">
            <Plus size={16} />
            {t('rules.penalties.add')}
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="rules-penalty-table">
            <thead>
              <tr className="text-start text-muted">
                <th className="text-start font-medium py-2 pe-3">{t('rules.penalties.code')}</th>
                <th className="text-start font-medium py-2 pe-3">{t('rules.penalties.label')}</th>
                <th className="text-start font-medium py-2 pe-3">{t('common:column.activity')}</th>
                <th className="text-start font-medium py-2 pe-3">{t('rules.penalties.amount')}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {penalties.map((row, index) => (
                <tr key={index} className="border-t border-line dark:border-dk-line align-top">
                  <td className="py-2 pe-3">
                    <input
                      className="lf-input font-mono text-xs"
                      value={row.code}
                      onChange={(e) => setPenalty(index, { code: e.target.value.toUpperCase() })}
                      data-testid={`rules-penalty-code-${index}`}
                    />
                  </td>
                  <td className="py-2 pe-3">
                    <input
                      className="lf-input"
                      value={row.label}
                      onChange={(e) => setPenalty(index, { label: e.target.value })}
                      data-testid={`rules-penalty-label-${index}`}
                    />
                  </td>
                  <td className="py-2 pe-3 min-w-[10rem]">
                    <Select
                      value={row.engineKind ?? ''}
                      onChange={(v) => setPenalty(index, { engineKind: (v || null) as EngineKind | null })}
                      options={[{ label: t('rules.penalties.everyActivity'), value: '' }, ...activities]}
                      testId={`rules-penalty-activity-${index}`}
                    />
                  </td>
                  <td className="py-2 pe-3">
                    <PenaltyAmount
                      value={row.amount}
                      onChange={(amount) => setPenalty(index, { amount })}
                      index={index}
                    />
                  </td>
                  <td className="py-2 text-end">
                    <Button
                      variant="ghost"
                      onClick={() => setPenalties(penalties.filter((_, i) => i !== index))}
                      title={t('common:action.remove')}
                      data-testid={`rules-penalty-remove-${index}`}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {incomplete && (
          <p className="flex items-center gap-2 text-sm text-danger-strong mt-3" role="alert">
            <TriangleAlert size={15} />
            {t('rules.penalties.incomplete')}
          </p>
        )}
      </Card>
    </div>
  )
}
