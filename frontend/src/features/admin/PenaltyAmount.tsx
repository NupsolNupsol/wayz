import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { Coins, Package } from 'lucide-react'
import { NumberInput } from '@/components/NumberInput'

export function PenaltyAmount({
  value,
  onChange,
  index,
}: {
  value: number | null
  onChange: (next: number | null) => void
  index: number
}) {
  const { t } = useTranslation(['admin', 'common'])
  const byAsset = value === null

  const Option = ({
    active,
    onClick,
    icon,
    label,
    testId,
  }: {
    active: boolean
    onClick: () => void
    icon: React.ReactNode
    label: string
    testId: string
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      className={clsx(
        'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-brand text-white'
          : 'bg-white dark:bg-dk-elevated text-muted hover:text-navy dark:hover:text-dk-texthi',
      )}
    >
      {icon}
      {label}
    </button>
  )

  return (
    <div className="min-w-[11rem]">
      <div className="flex rounded-xl2 border border-line dark:border-dk-line overflow-hidden">
        <Option
          active={!byAsset}
          onClick={() => onChange(value ?? 0)}
          icon={<Coins size={13} />}
          label={t('rules.penalties.flat')}
          testId={`rules-penalty-mode-flat-${index}`}
        />
        <Option
          active={byAsset}
          onClick={() => onChange(null)}
          icon={<Package size={13} />}
          label={t('rules.penalties.byAsset')}
          testId={`rules-penalty-mode-asset-${index}`}
        />
      </div>

      {byAsset ? (
        <p className="text-[11px] text-muted mt-1.5" data-testid={`rules-penalty-asset-note-${index}`}>
          {t('rules.penalties.byAssetNote')}
        </p>
      ) : (
        <div className="mt-1.5">
          <NumberInput
            value={value ?? 0}
            onChange={(next) => onChange(next)}
            min={0}
            step={5}
            testId={`rules-penalty-amount-${index}`}
            ariaLabel={t('rules.penalties.amount')}
          />
        </div>
      )}
    </div>
  )
}
