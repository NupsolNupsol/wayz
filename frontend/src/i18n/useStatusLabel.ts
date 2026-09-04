import { useTranslation } from 'react-i18next'

const GROUPS = [
  'booking',
  'delivery',
  'unit',
  'payment',
  'paymentKind',
  'method',
  'shift',
  'incident',
  'incidentType',
  'bag',
  'verification',
  'reconciliation',
  'scheme',
  'expense',
  'sessionKind',
] as const

export type StatusGroup = (typeof GROUPS)[number]

export function useStatusLabel() {
  const { t } = useTranslation('status')

  return (status: string, group?: StatusGroup): string => {
    if (!status) return ''
    const code = status.toUpperCase()
    const order = group ? [group, ...GROUPS.filter((g) => g !== group)] : GROUPS

    for (const candidate of order) {
      const value = t(`${candidate}.${code}`, { defaultValue: '' })
      if (value) return value
    }
    return status.replaceAll('_', ' ')
  }
}
