import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlaskConical, FastForward } from 'lucide-react'
import { Button, Card, Field, SectionTitle } from '@/components/ui'
import { NumberInput } from '@/components/NumberInput'
import { useAgeBooking, useDevClock } from '@/hooks'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'

const PRESETS = [30, 60, 120]

export function DevClockPanel({ bookingId, hasStarted }: { bookingId: string; hasStarted: boolean }) {
  const { t } = useTranslation(['bookings', 'common'])
  const { data } = useDevClock()
  const age = useAgeBooking()
  const [minutes, setMinutes] = useState(60)

  if (!data?.enabled) return null

  const move = (by: number) =>
    age.mutate(
      { id: bookingId, minutes: by },
      {
        onSuccess: (r) => toast('info', t('devClock.moved', { minutes: by }), t('devClock.movedDetail', { ref: r.ref })),
        onError: (e) => toast('danger', t('devClock.failed'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )

  return (
    <Card className="border-dashed" data-testid="dev-clock">
      <SectionTitle className="mb-1 flex items-center gap-2">
        <FlaskConical size={16} className="text-amber-500" /> {t('devClock.title')}
      </SectionTitle>
      <p className="text-xs text-muted mb-3">{t('devClock.blurb')}</p>

      {!hasStarted ? (
        <p className="text-xs text-amber-600" data-testid="dev-clock-not-started">{t('devClock.notStarted')}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            {PRESETS.map((by) => (
              <Button key={by} variant="secondary" onClick={() => move(by)} loading={age.isPending} data-testid={`dev-clock-${by}`}>
                <FastForward size={14} /> {t('devClock.forward', { minutes: by })}
              </Button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <Field label={t('devClock.custom')} className="mb-0 flex-1">
              <NumberInput value={minutes} onChange={setMinutes} min={-1440} max={1440} testId="dev-clock-minutes" />
            </Field>
            <Button onClick={() => move(minutes)} loading={age.isPending} data-testid="dev-clock-apply">
              {t('devClock.apply')}
            </Button>
          </div>
          <p className="text-[11px] text-muted mt-2">{t('devClock.rewindHint')}</p>
        </>
      )}
    </Card>
  )
}
