import { Select } from '@/components/Select'
import { useTranslation } from 'react-i18next'
import { CARD_SCHEMES } from '@/config/cardSchemes'
import type { CardScheme } from '@/config/cardSchemes'
import { schemeLabel } from './settlement'

export function PeriodBar({
  from,
  to,
  onFrom,
  onTo,
  scheme,
  onScheme,
  testId,
  children,
}: {
  from: string
  to: string
  onFrom: (v: string) => void
  onTo: (v: string) => void
  scheme?: '' | CardScheme
  onScheme?: (v: '' | CardScheme) => void
  testId: string
  children?: React.ReactNode
}) {
  const { t } = useTranslation(['accounting', 'common'])
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3" data-testid={testId}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{t('period.label')}</span>
        <input
          type="date"
          className="lf-input h-9 w-[150px]"
          value={from}
          onChange={(e) => onFrom(e.target.value)}
          data-testid={`${testId}-from`}
        />
        <span className="text-muted">to</span>
        <input
          type="date"
          className="lf-input h-9 w-[150px]"
          value={to}
          onChange={(e) => onTo(e.target.value)}
          data-testid={`${testId}-to`}
        />
      </div>

      {onScheme && (
        <div className="w-[190px]">
          <Select
            value={scheme ?? ''}
            onChange={(v) => onScheme(v as '' | CardScheme)}
            options={[
              { label: t('common:label.everycard'), value: '' },
              ...CARD_SCHEMES.map((s) => ({ label: schemeLabel(s), value: s })),
            ]}
            testId={`${testId}-scheme`}
          />
        </div>
      )}

      {children}
    </div>
  )
}
