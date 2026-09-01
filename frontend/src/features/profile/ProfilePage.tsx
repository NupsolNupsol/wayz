import { useNavigate } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import { LogOut, Building2, MapPin, Palette, IdCard } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, Button, SectionTitle, Badge } from '@/components/ui'
import { useAuthStore } from '@/store/auth'

export function ProfilePage() {
  const { t } = useTranslation(['agent', 'common'])
  const navigate = useNavigate()
  const me = useAuthStore((s) => s.me)
  const logout = useAuthStore((s) => s.logout)
  if (!me) return null

  return (
    <div data-testid="profile-page">
      <PageHeader helpId="profile" title={t('profile.title')} subtitle={t('profile.subtitle')} crumbs={[{ label: t('common:crumb.home'), to: '/dashboard' }, { label: t('common:crumb.profile') }]} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <SectionTitle className="mb-4">Agent</SectionTitle>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-brand text-brand-fg flex items-center justify-center text-xl font-bold">{me.fullName.split(' ').map((p) => p[0]).join('')}</div>
            <div>
              <p className="text-lg font-bold text-navy dark:text-dk-texthi">{me.fullName}</p>
              <p className="text-sm text-muted">{me.email}</p>
              <Badge tone="info" className="mt-1">{t(`common:role.${me.role}`, { defaultValue: me.role })}</Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Info icon={<Building2 size={16} />} label={t('profile.tenant')} value={me.tenant?.name ?? '—'} testId="profile-tenant" />
            <Info icon={<MapPin size={16} />} label={t('profile.station')} value={me.station?.name ?? '—'} testId="profile-station" />
            <Info icon={<IdCard size={16} />} label={t('common:field.phone')} value={me.phone} />
            <Info icon={<IdCard size={16} />} label={t('profile.engines')} value={t('profile.enginesEnabled', { count: me.tenant?.enabledEngines.length ?? 0 })} />
          </div>
        </Card>

        <Card>
          <SectionTitle className="mb-3 flex items-center gap-2"><Palette size={18} />{t('profile.theme')}</SectionTitle>
          <p className="text-xs text-muted mb-3">
            <Trans
              i18nKey="ui:profile.themeNote"
              values={{ file: 'src/styles/globals.css' }}
              components={{ 1: <span className="font-mono" /> }}
            />
          </p>
          <div className="flex flex-col gap-2">
            <Swatch label={t('profile.primary')} className="bg-brand" />
            <Swatch label={t('profile.secondary')} className="bg-secondary" />
            <Swatch label={t('profile.accent')} className="bg-switchc" />
          </div>
          <Button variant="danger" className="w-full mt-5" onClick={() => { logout(); navigate('/login') }} data-testid="profile-logout">
            <LogOut size={16} /> {t('common:action.signOut')}
          </Button>
        </Card>
      </div>
    </div>
  )
}

function Info({ icon, label, value, testId }: { icon: React.ReactNode; label: string; value: string; testId?: string }) {
  return (
    <div className="lf-card p-3 bg-canvas dark:bg-dk-elevated">
      <div className="flex items-center gap-1.5 text-muted text-xs mb-1">{icon} {label}</div>
      <p className="font-semibold text-navy dark:text-dk-text text-sm" data-testid={testId}>{value}</p>
    </div>
  )
}
function Swatch({ label, className }: { label: string; className: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`w-6 h-6 rounded-md border border-line ${className}`} />
      <span className="text-muted">{label}</span>
    </div>
  )
}
