import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { Modal } from './Modal'
import { Button, Field } from './ui'

export interface ReasonChoice {
  value: string
  label: string
}

export function ReasonDialog({
  open,
  onClose,
  onConfirm,
  title,
  subtitle,
  choices,
  confirmLabel,
  confirming,
  tone = 'danger',
  testId = 'reason-dialog',
}: {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
  title: string
  subtitle?: string
  choices: ReasonChoice[]
  confirmLabel: string
  confirming?: boolean
  tone?: 'danger' | 'primary'
  testId?: string
}) {
  const { t } = useTranslation(['common', 'ui'])
  const [picked, setPicked] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) {
      setPicked('')
      setNote('')
    }
  }, [open])

  const chosen = choices.find((c) => c.value === picked)
  const reason = picked === 'OTHER' ? note.trim() : [chosen?.label, note.trim()].filter(Boolean).join(' — ')
  const ready = reason.trim().length >= 3

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      testId={testId}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common:action.cancel')}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            disabled={!ready}
            loading={confirming}
            onClick={() => onConfirm(reason.trim())}
            data-testid={`${testId}-submit`}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-xs uppercase tracking-wider text-muted font-bold mb-2">{t('common:field.reason')}</p>
      <div className="flex flex-wrap gap-2 mb-4" data-testid={`${testId}-choices`}>
        {choices.map((choice) => (
          <button
            key={choice.value}
            type="button"
            onClick={() => setPicked(choice.value)}
            data-testid={`${testId}-choice-${choice.value}`}
            className={clsx(
              'lf-btn !h-9 !px-3 text-xs border',
              picked === choice.value ? 'bg-brand text-brand-fg border-brand' : 'bg-surface border-line text-muted hover:text-brand',
            )}
          >
            {choice.label}
          </button>
        ))}
      </div>

      <Field label={t('common:field.notes')} hint={picked === 'OTHER' ? t('common:field.reasonRequired') : undefined}>
        <textarea
          className="lf-input min-h-[80px]"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          data-testid={`${testId}-note`}
        />
      </Field>
    </Modal>
  )
}
