import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScanLine, Check, PackageCheck } from 'lucide-react'
import { clsx } from 'clsx'
import { Button } from './ui'
import type { BagItem } from '@/api/types'

export interface StorageScanPayload {
  scannedUnitId: string
  scannedBarcodes: string[]
  durationMin: number
}

export function StorageScanPanel({
  bags,
  unitId,
  unitIdentifier,
  durationMin,
  onConfirm,
  pending,
  disabled,
  testIdPrefix = 'store',
}: {
  bags: BagItem[]
  unitId: string
  unitIdentifier: string
  durationMin: number
  onConfirm: (payload: StorageScanPayload) => void
  pending?: boolean
  disabled?: boolean
  testIdPrefix?: string
}) {
  const { t } = useTranslation('ui')
  const [compartmentScanned, setCompartmentScanned] = useState(false)
  const [scanned, setScanned] = useState<Set<string>>(new Set())
  const [manual, setManual] = useState('')

  const known = useMemo(() => new Set(bags.map((b) => b.barcode)), [bags])
  const allScanned = bags.length > 0 && bags.every((b) => scanned.has(b.barcode))
  const ready = compartmentScanned && allScanned

  const scan = (barcode: string) => {
    const code = barcode.trim()
    if (!code) return
    setScanned((s) => new Set(s).add(code))
    setManual('')
  }

  return (
    <div data-testid={`${testIdPrefix}-scan-panel`}>
      <button
        type="button"
        onClick={() => setCompartmentScanned(true)}
        disabled={compartmentScanned}
        data-testid={`${testIdPrefix}-scan-compartment`}
        className={clsx(
          'w-full lf-card p-3 flex items-center gap-2 mb-3',
          compartmentScanned ? 'border-success bg-emerald-50 dark:bg-emerald-900/20 text-success' : 'hover:border-brand',
        )}
      >
        {compartmentScanned ? <Check size={18} /> : <ScanLine size={18} />} Scan compartment {unitIdentifier}
      </button>

      <p className="text-xs text-muted mb-2">
        Scan every bag into the compartment ({scanned.size}/{bags.length}):
      </p>
      <div className="flex flex-col gap-2 mb-3">
        {bags.map((b) => {
          const done = scanned.has(b.barcode)
          return (
            <button
              key={b.index}
              type="button"
              onClick={() => scan(b.barcode)}
              disabled={done}
              data-testid={`${testIdPrefix}-scan-bag-${b.index}`}
              className={clsx(
                'lf-card p-2.5 flex items-center justify-between text-sm',
                done ? 'border-success bg-emerald-50 dark:bg-emerald-900/20' : 'hover:border-brand',
              )}
            >
              <span className="flex items-center gap-2">
                {done ? <Check size={16} className="text-success" /> : <ScanLine size={16} />} Bag {b.index} · {b.description}
              </span>
              <span className="font-mono text-xs text-muted">{b.barcode}</span>
            </button>
          )
        })}
      </div>

      <div className="flex gap-2 mb-3">
        <input
          className="lf-input"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && scan(manual)}
          placeholder={t('storage.scanPlaceholder')}
          data-testid={`${testIdPrefix}-scan-manual`}
        />
        <Button variant="secondary" onClick={() => scan(manual)} disabled={!manual.trim()} data-testid={`${testIdPrefix}-scan-manual-add`}>{t('storage.addScan')}</Button>
      </div>
      {[...scanned].some((s) => !known.has(s)) && (
        <p className="text-xs text-danger-strong mb-2" data-testid={`${testIdPrefix}-scan-foreign`}>{t('storage.wrongBag')}</p>
      )}

      <Button
        onClick={() => onConfirm({ scannedUnitId: unitId, scannedBarcodes: [...scanned], durationMin })}
        loading={pending}
        disabled={disabled || !ready}
        className="w-full"
        data-testid={`${testIdPrefix}-confirm-storage`}
      >
        <PackageCheck size={16} />{t('storage.confirm')}</Button>
      {!ready && (
        <p className="text-xs text-amber-600 mt-2">{t('storage.hint')}</p>
      )}
    </div>
  )
}
