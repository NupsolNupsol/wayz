import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ClipboardCheck } from 'lucide-react'

import { Field, SectionTitle } from '@/components/ui'
import { Select } from '@/components/Select'
import { Counter } from '@/components/Counter'
import { catalogueApi } from '@/api/catalogue.api'
import { useWorkflows } from '@/hooks'
import type { Booking, EngineKind, IntakeField } from '@/api/types'

/**
 * The details an activity needs before its booking can be confirmed.
 *
 * Nothing here decides *which* details — the activity's own coded module declares them
 * (`intake` on its workflow), next to the validator that refuses a booking without them. This
 * renders whatever that declaration says, so WIQAR's horse ride asks for consent and a trainer,
 * its lesson also asks for a level, its group package for a party of five and the feed — and
 * a WAYZ activity, which declares nothing, renders nothing and its counter is unchanged.
 *
 * Before this existed, the rules were enforced and the counter never asked: payment failed with
 * "cannot confirm", and the reasons never reached the screen.
 */

export interface IntakeValue {
  consent: boolean
  trainerId: string
  level: string
  partySize: number
  feedPortions: number
}

export function useIntakeFields(engineKind: EngineKind): IntakeField[] {
  const { data: workflows = [] } = useWorkflows()
  return useMemo(() => workflows.find((w) => w.engineKind === engineKind)?.intake ?? [], [workflows, engineKind])
}

/** What is already recorded on the booking — a resumed sale picks up where it stopped. */
function recorded(booking: Booking, fields: IntakeField[]): IntakeValue {
  const m = booking.metadata ?? {}
  const party = fields.find((f) => f.key === 'partySize')
  const feed = fields.find((f) => f.key === 'feedPortions')
  return {
    consent: !!m.consentAt,
    trainerId: typeof m.trainerId === 'string' ? m.trainerId : '',
    level: typeof m.level === 'string' ? m.level : '',
    partySize: Number(m.partySize) || (party && 'min' in party ? party.min : 1),
    feedPortions: Number(m.feedPortions) || (feed && 'min' in feed ? feed.min : 1),
  }
}

export function isIntakeComplete(fields: IntakeField[], v: IntakeValue): boolean {
  return fields.every((f) => {
    switch (f.key) {
      case 'consent':
        return v.consent
      case 'trainer':
        return !!v.trainerId
      case 'level':
        return f.options.includes(v.level)
      case 'partySize':
        return v.partySize >= f.min
      case 'feedPortions':
        return v.feedPortions >= f.min
    }
  })
}

/** Only what the activity declares is sent. */
export function intakeBody(fields: IntakeField[], v: IntakeValue) {
  const body: Record<string, unknown> = {}
  for (const f of fields) {
    if (f.key === 'consent') body.consent = v.consent
    if (f.key === 'trainer') body.trainerId = v.trainerId || null
    if (f.key === 'level') body.level = v.level || null
    if (f.key === 'partySize') body.partySize = v.partySize
    if (f.key === 'feedPortions') body.feedPortions = v.feedPortions
  }
  return body
}

export function ExperienceIntake({
  engineKind,
  booking,
  onChange,
}: {
  engineKind: EngineKind
  booking: Booking
  onChange: (value: IntakeValue, complete: boolean) => void
}) {
  const { t } = useTranslation(['agent', 'common'])
  const fields = useIntakeFields(engineKind)
  const [value, setValue] = useState<IntakeValue>(() => recorded(booking, fields))

  /* The declaration arrives with the workflows; take the booking's record once it does. */
  const fieldKeys = fields.map((f) => f.key).join(',')
  useEffect(() => {
    setValue(recorded(booking, fields))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.id, fieldKeys])

  useEffect(() => {
    onChange(value, isIntakeComplete(fields, value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, fieldKeys])

  const needsTrainer = fields.some((f) => f.key === 'trainer')
  const { data: trainers = [], isLoading: trainersLoading } = useQuery({
    queryKey: ['catalogue', 'trainers', engineKind],
    queryFn: () => catalogueApi.trainers(engineKind),
    enabled: needsTrainer,
  })

  if (fields.length === 0) return null

  const set = (patch: Partial<IntakeValue>) => setValue((v) => ({ ...v, ...patch }))

  return (
    <div className="mb-4 rounded-xl2 border border-line p-3 dark:border-dk-line" data-testid="experience-intake">
      <SectionTitle className="mb-2 flex items-center gap-2 text-sm">
        <ClipboardCheck size={15} className="text-brand" />
        {t('engine.intake.title', { defaultValue: 'Before confirming' })}
      </SectionTitle>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((f) => {
          switch (f.key) {
            case 'trainer':
              return (
                <Field
                  key={f.key}
                  label={t('engine.intake.trainer', { defaultValue: 'Trainer running the session' })}
                  required
                  hint={
                    !trainersLoading && trainers.length === 0
                      ? t('engine.intake.noTrainer', {
                          defaultValue: 'Nobody at this location is assigned to this activity — assign someone on the Team page.',
                        })
                      : undefined
                  }
                >
                  <Select
                    value={value.trainerId}
                    onChange={(id) => set({ trainerId: id })}
                    options={[
                      { label: t('engine.intake.pickTrainer', { defaultValue: 'Choose who will run it' }), value: '' },
                      ...trainers.map((p) => ({ label: p.title ? `${p.name} · ${p.title}` : p.name, value: p.id })),
                    ]}
                    testId="intake-trainer"
                  />
                </Field>
              )

            case 'level':
              return (
                <Field key={f.key} label={t('engine.intake.level', { defaultValue: 'Level' })} required>
                  <Select
                    value={value.level}
                    onChange={(level) => set({ level })}
                    options={[
                      { label: t('engine.intake.pickLevel', { defaultValue: 'Choose the level' }), value: '' },
                      ...f.options.map((o) => ({
                        label: t(`engine.intake.levels.${o}`, { defaultValue: o.charAt(0) + o.slice(1).toLowerCase() }),
                        value: o,
                      })),
                    ]}
                    testId="intake-level"
                  />
                </Field>
              )

            case 'partySize':
              return (
                <Field
                  key={f.key}
                  label={t('engine.intake.party', { defaultValue: 'People in the party' })}
                  required
                  hint={t('engine.intake.partyHint', { defaultValue: 'At least {{min}}', min: f.min })}
                >
                  <Counter
                    min={f.min}
                    value={value.partySize}
                    onChange={(n) => set({ partySize: n })}
                    testId="intake-party"
                    ariaLabel="party size"
                  />
                </Field>
              )

            case 'feedPortions':
              return (
                <Field key={f.key} label={t('engine.intake.feed', { defaultValue: 'Feed portions bought' })} required>
                  <Counter
                    min={f.min}
                    value={value.feedPortions}
                    onChange={(n) => set({ feedPortions: n })}
                    testId="intake-feed"
                    ariaLabel="feed portions"
                  />
                </Field>
              )

            default:
              return null
          }
        })}
      </div>

      {fields.some((f) => f.key === 'consent') && (
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm" data-testid="intake-consent">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={value.consent}
            disabled={!!booking.metadata?.consentAt}
            onChange={(e) => set({ consent: e.target.checked })}
          />
          <span>
            {t('engine.intake.consent', {
              defaultValue: 'The visitor has read and accepts the terms and conditions of this experience.',
            })}
          </span>
        </label>
      )}
    </div>
  )
}
