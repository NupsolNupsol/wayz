import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Compass } from 'lucide-react'

export function NotFoundPage() {
  const { t } = useTranslation(['auth', 'common'])
  return (
    <div className="min-h-screen flex items-center justify-center p-6" data-testid="not-found">
      <div className="text-center">
        <Compass className="mx-auto text-brand mb-3" size={40} />
        <h1 className="text-3xl font-bold text-navy">{t('notFound.title')}</h1>
        <p className="text-muted mt-2">{t('notFound.message')}</p>
        <Link to="/dashboard" className="lf-btn-primary mt-5 inline-flex no-underline">{t('notFound.back')}</Link>
      </div>
    </div>
  )
}
