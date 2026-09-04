import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, KeyRound, MailCheck, Power, Send, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button, Field, Spinner, Badge, StatCard } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { Select } from '@/components/Select'
import { PhoneInput } from '@/components/PhoneInput'
import { useCreateStaff, useManagerOrg, useManagerStaff, useReinviteStaff, useResetStaffPassword, useUpdateStaff } from '@/hooks'
import { ApiError } from '@/api/client'
import { formatDateTime } from '@/utils'
import { toast } from '@/state/toastStore'
import { clsx } from 'clsx'
import { engineLabel, visibleEngineOptions } from '@/config/engineMeta'
import {
  ROLE_ORDER,
  assignableBy,
  isActivityScoped,
  isKioskScoped,
  isLagoonOnly,
  isSubManager,
} from '@/config/roleRules'
import type { EngineKind, Role } from '@/api/types'
import type { ManagerStaff } from '@/api/manager.api'
import { useAuthStore } from '@/store/auth'

const readEngines = (value?: string): EngineKind[] =>
  (value ?? '').split(',').filter(Boolean) as EngineKind[]

export function ManagerTeam() {
  const { t } = useTranslation(['manager', 'common'])
  const { data: staff = [], isLoading } = useManagerStaff()
  const { data: org } = useManagerOrg()
  const createStaff = useCreateStaff()
  const updateStaff = useUpdateStaff()
  const resetPassword = useResetStaffPassword()
  const reinvite = useReinviteStaff()

  const [editing, setEditing] = useState<ManagerStaff | null>(null)
  const [creating, setCreating] = useState(false)
  const [pwdFor, setPwdFor] = useState<ManagerStaff | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [password, setPassword] = useState('')
  const [inviteLink, setInviteLink] = useState<{ person: ManagerStaff; link: string; reason: string } | null>(null)

  const stations = (org?.sites ?? []).flatMap((s) => s.stations.map((st) => ({ label: `${s.name} — ${st.name}`, value: st._id })))
  const kiosksByStation = (org?.sites ?? []).flatMap((s) =>
    s.stations.flatMap((st) =>
      st.kiosks.map((k) => ({
        label: `${k.name} · ${engineLabel(k.engineKind)}`,
        value: k._id,
        stationId: st._id,
        engineKind: k.engineKind,
      })),
    ),
  )

  const leadOptions = staff
    .filter((u) => u.role === 'PROJECT_MANAGER' || u.role === 'MANAGER')
    .map((u) => ({ label: `${u.fullName} · ${t(`common:role.${u.role}`)}`, value: u._id }))

  useEffect(() => {
    if (!creating && !editing) return
    if (form.stationId || stations.length === 0) return
    setForm((prev) => (prev.stationId ? prev : { ...prev, stationId: stations[0].value }))
  }, [creating, editing, form.stationId, stations])

  const engines = readEngines(form.engineKinds)
  const role = (form.role ?? 'AGENT') as Role
  const scopedToActivities = isActivityScoped(role)
  const needsKiosk = isKioskScoped(role)

  const kiosksHere = kiosksByStation.filter(
    (k) => k.stationId === form.stationId && (!engines.length || engines.includes(k.engineKind)),
  )

  useEffect(() => {
    if (!needsKiosk) return
    if (form.kioskId && kiosksHere.some((k) => k.value === form.kioskId)) return
    setForm((prev) => ({ ...prev, kioskId: kiosksHere[0]?.value ?? '' }))
  }, [needsKiosk, form.stationId, form.kioskId, form.engineKinds, kiosksHere])

  useEffect(() => {
    if (!scopedToActivities) return
    const trimmed = isLagoonOnly(role)
      ? (['LAGOON'] as EngineKind[])
      : needsKiosk && engines.length > 1
        ? engines.slice(0, 1)
        : engines
    if (trimmed.join(',') !== engines.join(',')) {
      setForm((prev) => ({ ...prev, engineKinds: trimmed.join(',') }))
    }
  }, [role, scopedToActivities, needsKiosk, engines])

  const fail = (e: unknown) => toast('danger', t('common:error.couldNotSave'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : '')

  const openCreate = () => {
    setForm({
      fullName: '',
      email: '',
      role: 'AGENT',
      stationId: stations[0]?.value ?? '',
      kioskId: '',
      engineKinds: '',
      reportsTo: '',
      phone: '',
    })
    setCreating(true)
  }

  const openEdit = (u: ManagerStaff) => {
    setForm({
      fullName: u.fullName,
      email: u.email,
      role: u.role,
      stationId: u.stationId,
      kioskId: u.kioskId ?? '',
      engineKinds: (u.engineKinds ?? []).join(','),
      reportsTo: u.reportsTo ?? '',
      phone: u.phone ?? '',
    })
    setEditing(u)
  }

  const missingStation = !form.stationId
  const missingActivity = scopedToActivities && engines.length === 0
  const canSubmitCreate =
    !!form.fullName?.trim() && !!form.email?.trim() && !missingStation && !missingActivity && !(needsKiosk && !form.kioskId)
  const canSubmitEdit = !missingStation && !missingActivity && !(needsKiosk && !form.kioskId)

  const announce = (person: ManagerStaff, resent = false) => {
    const invitation = person.invitation
    if (invitation?.emailed) {
      toast(
        'success',
        resent ? 'Invitation re-sent' : 'Invitation sent',
        `${person.fullName} has an email at ${invitation.deliveredTo} to choose their own password.`,
      )
      return
    }
    setInviteLink(invitation?.link ? { person, link: invitation.link, reason: invitation.reason ?? '' } : null)
  }

  const submitCreate = () => {
    createStaff.mutate(
      {
        fullName: form.fullName,
        email: form.email,
        role: form.role,
        stationId: form.stationId,
        kioskId: needsKiosk ? form.kioskId : null,
        engineKinds: engines,
        reportsTo: isSubManager(role) ? form.reportsTo || null : null,
        phone: form.phone,
      },
      {
        onSuccess: (person) => {
          setCreating(false)
          announce(person)
        },
        onError: fail,
      },
    )
  }

  const resend = (person: ManagerStaff) => {
    reinvite.mutate(person._id, { onSuccess: (updated) => announce({ ...person, ...updated }, true), onError: fail })
  }

  const submitEdit = () => {
    if (!editing) return
    updateStaff.mutate(
      {
        id: editing._id,
        patch: {
          fullName: form.fullName,
          email: form.email,
          role: form.role,
          stationId: form.stationId,
          kioskId: needsKiosk ? form.kioskId : null,
          engineKinds: engines,
          reportsTo: isSubManager(role) ? form.reportsTo || null : null,
          phone: form.phone,
        },
      },
      { onSuccess: () => { toast('success', t('team.accountUpdated')); setEditing(null) }, onError: fail },
    )
  }

  const toggleActive = (u: ManagerStaff) => {
    updateStaff.mutate(
      { id: u._id, patch: { active: !u.active } },
      { onSuccess: () => toast(u.active ? 'warning' : 'success', u.active ? 'Account suspended' : 'Account restored'), onError: fail },
    )
  }

  const submitPassword = () => {
    if (!pwdFor) return
    resetPassword.mutate(
      { id: pwdFor._id, password },
      { onSuccess: () => { toast('success', t('team.passwordReset'), `Give it to ${pwdFor.fullName} directly.`); setPwdFor(null); setPassword('') }, onError: fail },
    )
  }

  return (
    <div data-testid="manager-team">
      <PageHeader
        title={t('team.title')}
        subtitle={t('team.subtitle')}
        crumbs={[{ label: t('common:crumb.manager') }, { label: t('common:crumb.team') }]}
        actions={<Button onClick={openCreate} data-testid="team-add"><UserPlus size={16} />{t('team.addMember')}</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <StatCard label={t('team.headcount')} value={staff.length} icon={<Users size={18} />} tone="neutral" testId="team-stat-total" />
        <StatCard label={t('common:state.active')} value={staff.filter((u) => u.active).length} icon={<ShieldCheck size={18} />} tone="success" testId="team-stat-active" />
        <StatCard label={t('team.onShiftNow')} value={staff.filter((u) => u.hasOpenShift).length} icon={<Clock size={18} />} tone="info" testId="team-stat-onshift" />
      </div>

      {isLoading ? <Spinner /> : (
        <DataTable
          testId="team-table"
          rows={staff}
          keyOf={(r) => r._id}
          empty={{ title: t('team.noAccounts'), message: t('team.addFirst') }}
          columns={[
            {
              key: 'name',
              header: t('common:column.name'),
              sortValue: (r) => r.fullName,
              filter: { kind: 'text', value: (r) => `${r.fullName} ${r.email}` },
              render: (r) => (
                <div>
                  <p className="font-semibold text-navy dark:text-dk-texthi">{r.fullName}</p>
                  <p className="text-xs text-muted">{r.email}</p>
                </div>
              ),
            },
            {
              key: 'role',
              header: t('common:column.role'),
              filter: { kind: 'select', options: ROLE_ORDER.map((value) => ({ label: t(`common:role.${value}`), value })), value: (r) => r.role },
              render: (r) => <Badge tone="neutral">{t(`common:role.${r.role}`)}</Badge>,
            },
            {
              key: 'station',
              header: t('common:column.station'),
              filter: { kind: 'text', value: (r) => `${r.stationName} ${r.kioskName ?? ''}` },
              render: (r) => (
                <div>
                  <p className="text-sm text-muted">{r.stationName}</p>
                  {r.kioskName && <p className="text-[11px] text-muted">{t('common:field.kiosk')} · {r.kioskName}</p>}
                </div>
              ),
            },
            {
              key: 'activities',
              header: t('common:column.activities'),
              filter: {
                kind: 'select',
                options: visibleEngineOptions(),
                value: (r) => (r.engineKinds ?? []).join(','),
              },
              render: (r) =>
                (r.engineKinds ?? []).length ? (
                  <div className="flex flex-wrap gap-1">
                    {(r.engineKinds ?? []).map((k) => (
                      <Badge key={k} tone="info">{engineLabel(k)}</Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted">{t('common:table.all')}</span>
                ),
            },
            {
              key: 'status',
              header: t('common:column.status'),
              filter: { kind: 'select', options: [{ label: t('common:label.active'), value: 'yes' }, { label: t('common:label.suspended'), value: 'no' }], value: (r) => (r.active ? 'yes' : 'no') },
              render: (r) => (
                <div className="flex items-center gap-1.5">
                  {!r.setUp ? (
                    <Badge tone={r.invitePending ? 'info' : 'warning'}>
                      {r.invitePending ? t('team.invited') : t('team.inviteExpired')}
                    </Badge>
                  ) : (
                    <Badge tone={r.active ? 'success' : 'danger'}>{r.active ? t('common:state.active') : t('common:state.suspended')}</Badge>
                  )}
                  {r.hasOpenShift && (
                    <Badge tone={r.shiftStatus === 'RECONCILING' ? 'danger' : 'info'}>
                      {r.shiftStatus === 'RECONCILING' ? t('team.reconciling') : t('team.onShift')}
                    </Badge>
                  )}
                </div>
              ),
            },
            { key: 'handled', header: t('common:column.bookings'), align: 'right', sortValue: (r) => r.bookingsHandled, render: (r) => <span className="tabular-nums">{r.bookingsHandled}</span> },
            { key: 'last', header: t('team.lastLogin'), align: 'right', render: (r) => <span className="text-muted text-xs">{r.lastLoginAt ? formatDateTime(new Date(r.lastLoginAt).getTime()) : t('common:state.never')}</span> },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (r) => (
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(r) }} data-testid={`team-edit-${r._id}`}>{t('common:action.edit')}</Button>
                  {r.setUp ? (
                    <Button variant="ghost" onClick={(e) => { e.stopPropagation(); setPwdFor(r); setPassword('') }} title={t('team.resetPassword')} data-testid={`team-reset-${r._id}`}><KeyRound size={14} /></Button>
                  ) : (
                    <Button variant="ghost" onClick={(e) => { e.stopPropagation(); resend(r) }} loading={reinvite.isPending} title={t('team.resendInvitation')} data-testid={`team-reinvite-${r._id}`}><Send size={14} /></Button>
                  )}
                  <Button variant="ghost" onClick={(e) => { e.stopPropagation(); toggleActive(r) }} title={r.active ? t('common:action.suspend') : t('common:action.restore')}><Power size={14} /></Button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={t('team.addTeamMember')}
        subtitle={t('team.inviteNote')}
        testId="team-create-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>{t('common:action.cancel')}</Button>
            <Button
              onClick={submitCreate}
              loading={createStaff.isPending}
              disabled={!canSubmitCreate}
              data-testid="team-create-submit"
            >{t('team.createAccount')}</Button>
          </>
        }
      >
        <StaffFields form={form} setForm={setForm} stations={stations} kiosks={kiosksHere} leads={leadOptions} />
        <div className="flex items-start gap-2 text-sm text-muted" data-testid="team-invite-note">
          <MailCheck size={16} className="text-brand shrink-0 mt-0.5" />
          <p>
            Saving emails them a link that works once and expires in three days. Nobody here ever sees their password —
            not you, not the platform.
          </p>
        </div>
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.fullName ?? ''}`}
        testId="team-edit-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>{t('common:action.cancel')}</Button>
            <Button onClick={submitEdit} loading={updateStaff.isPending} disabled={!canSubmitEdit} data-testid="team-edit-submit">{t('common:action.save')}</Button>
          </>
        }
      >
        <StaffFields form={form} setForm={setForm} stations={stations} kiosks={kiosksHere} leads={leadOptions} />
      </Modal>

      <Modal
        open={!!pwdFor}
        onClose={() => setPwdFor(null)}
        title={t('team.resetPassword')}
        subtitle={pwdFor ? `A new password for ${pwdFor.fullName}` : undefined}
        testId="team-password-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPwdFor(null)}>{t('common:action.cancel')}</Button>
            <Button onClick={submitPassword} loading={resetPassword.isPending} disabled={password.length < 8} data-testid="team-password-submit">{t('team.setPassword')}</Button>
          </>
        }
      >
        <Field label={t('team.newPassword')} required hint={t('team.passwordHint')}>
          <input type="text" className="lf-input font-mono" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="team-password-input" />
        </Field>
      </Modal>

      <Modal
        open={!!inviteLink}
        onClose={() => setInviteLink(null)}
        title={t('team.inviteFailed')}
        subtitle={inviteLink ? `Give this link to ${inviteLink.person.fullName} yourself.` : undefined}
        testId="team-invite-link-modal"
        footer={<Button onClick={() => setInviteLink(null)} data-testid="team-invite-link-close">{t('common:action.done')}</Button>}
      >
        <p className="text-sm text-muted mb-3">
          {inviteLink?.reason || 'The mail provider did not accept the message.'} The account exists and cannot be used
          until they set a password.
        </p>
        <Field label={t('team.inviteLink')} hint={t('team.inviteLinkHint')}>
          <input
            readOnly
            className="lf-input font-mono text-xs"
            value={inviteLink?.link ?? ''}
            onFocus={(e) => e.currentTarget.select()}
            data-testid="team-invite-link"
          />
        </Field>
      </Modal>
    </div>
  )
}

function StaffFields({
  form,
  setForm,
  stations,
  kiosks,
  leads,
}: {
  form: Record<string, string>
  setForm: (f: Record<string, string>) => void
  stations: { label: string; value: string }[]
  kiosks: { label: string; value: string }[]
  leads: { label: string; value: string }[]
}) {
  const { t } = useTranslation(['manager', 'common'])
  const myRole = useAuthStore((s) => s.me?.role)
  const roleOptions = assignableBy(myRole).map((value) => ({ label: t(`common:role.${value}`), value }))
  const engines = readEngines(form.engineKinds)
  const role = (form.role ?? 'AGENT') as Role
  const scopedToActivities = isActivityScoped(role)
  const needsKiosk = isKioskScoped(role)
  const oneActivityOnly = needsKiosk
  const activityOptions = isLagoonOnly(role)
    ? visibleEngineOptions().filter((o) => o.value === 'LAGOON')
    : visibleEngineOptions()
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })
  return (
    <>
      <Field label={t('common:field.fullName')} required><input className="lf-input" value={form.fullName ?? ''} onChange={set('fullName')} data-testid="team-name" /></Field>
      <Field label={t('common:field.email')} required hint={t('manager:team.emailHint')}>
        <input type="email" className="lf-input" value={form.email ?? ''} onChange={set('email')} data-testid="team-email" />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label={t('common:field.role')} required>
          <Select value={form.role ?? 'AGENT'} onChange={(v) => setForm({ ...form, role: v })} options={roleOptions} testId="team-role" />
        </Field>
        <Field
          label={t('common:field.station')}
          required
          hint={t('team.stationHint')}
          error={stations.length === 0 ? 'No stations yet — create one under Organisation first.' : undefined}
        >
          <Select value={form.stationId ?? ''} onChange={(v) => setForm({ ...form, stationId: v })} options={stations} searchable testId="team-station" />
        </Field>
      </div>
      {scopedToActivities && (
        <Field
          label={t('common:field.activities')}
          required
          hint={t('team.activitiesHint')}
          error={engines.length === 0 ? 'Choose at least one activity.' : undefined}
        >
          <div className="flex flex-wrap gap-2" data-testid="team-activities">
            {activityOptions.map((opt) => {
              const on = engines.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  data-testid={`team-activity-${opt.value}`}
                  aria-pressed={on}
                  onClick={() =>
                    setForm({
                      ...form,
                      engineKinds: (oneActivityOnly
                        ? on
                          ? []
                          : [opt.value]
                        : on
                          ? engines.filter((e) => e !== opt.value)
                          : [...engines, opt.value]
                      ).join(','),
                      kioskId: '',
                    })
                  }
                  className={clsx(
                    'px-3 py-2 rounded-xl2 text-sm font-semibold border transition-colors',
                    on
                      ? 'bg-brand text-white border-brand'
                      : 'bg-white dark:bg-dk-surface text-navy dark:text-dk-texthi border-line dark:border-dk-line hover:border-brand',
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </Field>
      )}
      {needsKiosk && (
        <Field
          label={t('common:field.kiosk')}
          required
          hint={t('team.kioskHint')}
          error={
            engines.length === 0
              ? t('team.pickActivityFirst')
              : kiosks.length === 0
                ? t('team.noKioskForActivity')
                : undefined
          }
        >
          <Select value={form.kioskId ?? ''} onChange={(v) => setForm({ ...form, kioskId: v })} options={kiosks} testId="team-kiosk" />
        </Field>
      )}
      {isSubManager(role) && (
        <Field label={t('team.reportsTo')} hint={t('team.reportsToHint')}>
          <Select
            value={form.reportsTo ?? ''}
            onChange={(v) => setForm({ ...form, reportsTo: v })}
            options={[{ label: t('team.reportsToNobody'), value: '' }, ...leads]}
            testId="team-reports-to"
          />
        </Field>
      )}
      <Field label={t('common:field.phone')}>
        <PhoneInput value={form.phone ?? ''} onChange={(v) => setForm({ ...form, phone: v })} testId="team-phone" />
      </Field>
    </>
  )
}
