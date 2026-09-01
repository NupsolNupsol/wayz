import { useTranslation } from 'react-i18next'

const slug = (label: string): string => label.toLowerCase().replace(/[^a-z0-9]+/g, '')

/**
 * Workflow transition labels come from the server in English. Translate them by
 * their own wording, so a new transition still renders rather than disappearing.
 */
export function useActionLabel(): (label: string) => string {
  const { t } = useTranslation('workflow')
  return (label: string) => t(`action.${slug(label)}`, { defaultValue: label })
}
