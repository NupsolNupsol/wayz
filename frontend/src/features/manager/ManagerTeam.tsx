import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, KeyRound, MailCheck, Power, Send, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button, Field, Spinner, Badge, StatCard } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { Select } from '@/components/Select'
import { PhoneInput } from '@/components/PhoneInput'
import { useCreateStaff, useManagerOrg, useManagerStaff, useReinviteStaff, useRemoveStaff, useResetStaffPassword, useUpdateStaff } from '@/hooks'
import { ApiError } from '@/api/client'
import { formatDateTime } from '@/utils'
import { toast } from '@/state/toastStore'
import { clsx } from 'clsx'
import { engineLabel } from '@/config/engineMeta'
import type { EngineKind, Role } from '@/api/types'
import type { ManagerStaff } from '@/api/manager.api'
import { roleApi, type Assignable, type RoleDefinition as TenantRole } from '@/api/role.api'
import { activityApi } from '@/api/activity.api'

/**
 * Whether this job reports to somebody.
 *
 * The last surviving line of `config/roleRules.ts`, which held a browser-side copy of the
 * backend's role policy — which jobs exist, what each may work, how far each can see. That
 * copy drifted, and it had to: those questions are now answered by the tenant's own role
 * definitions, read from `/api/roles`, and a constant compiled into the bundle cannot know
 * what a company defined this morning.
 *
 * This one is not policy. It asks whether the form should offer a "reports to" field, which is
 * a question about the *shape* of the platform's base roles and is settled at build time. It
 * lives here, beside its only caller, rather than in a config module that invited more.
 */
const SUB_MANAGER_ROLES: Role[] = ['MANAGER', 'SUPERVISOR']
const isSubManager = (role: Role): boolean => SUB_MANAGER_ROLES.includes(role)

const readEngines = (value?: string): EngineKind[] =>
  (value ?? '').split(',').filter(Boolean) as EngineKind[]

/** Tenant activity keys, which are arbitrary strings rather than a compiled-in enum. */
function readKeys(csv?: string): string[] {
  return (csv ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

export function ManagerTeam() {
  const { t } = useTranslation(['manager', 'common'])
  const { data: staff = [], isLoading } = useManagerStaff()
  const { data: org } = useManagerOrg()
  const createStaff = useCreateStaff()
  const updateStaff = useUpdateStaff()
  const resetPassword = useResetStaffPassword()
  const reinvite = useReinviteStaff()
  const removeStaff = useRemoveStaff()
  const [removing, setRemoving] = useState<ManagerStaff | null>(null)

  const [editing, setEditing] = useState<ManagerStaff | null>(null)
  const [creating, setCreating] = useState(false)
  const [pwdFor, setPwdFor] = useState<ManagerStaff | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [password, setPassword] = useState('')
  const [inviteLink, setInviteLink] = useState<{ person: ManagerStaff; link: string; reason: string } | null>(null)

  const stations = (org?.sites ?? []).flatMap((s) => s.stations.map((st) => ({ label: `${s.name} — ${st.name}`, value: st._id })))
  const gatesByStation = (org?.sites ?? []).flatMap((s) =>
    s.stations.flatMap((st) => st.gates.map((g) => ({ label: g.name, value: g._id, stationId: st._id }))),
  )
  const kiosksByStation = (org?.sites ?? []).flatMap((s) =>
    s.stations.flatMap((st) =>
      st.kiosks.map((k) => ({
        // A counter that runs no built-in engine is named by itself — appending the label
        // helper's answer for `null` put the word "null" beside every WIQAR counter.
        label: k.engineKind ? `${k.name} · ${engineLabel(k.engineKind)}` : k.name,
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

  /*
   * The jobs this company has defined.
   *
   * Loaded once for the whole screen: the table filters on them and the form offers them, and
   * both used to read a compiled-in list of nine names that belonged to one tenant.
   */
  const [roles, setRoles] = useState<TenantRole[]>([])
  useEffect(() => {
    roleApi
      .list()
      .then(setRoles)
      .catch(() => setRoles([]))
  }, [])

  /*
   * What this company calls each of its activities.
   *
   * Only for labelling: the table holds activity *keys*, and a key is what an administrator
   * typed, not what anybody wants to read in a column. Falls back to the key with its
   * underscores removed, which is still better than showing the raw key.
   */
  const [activityNames, setActivityNames] = useState<Record<string, string>>({})
  useEffect(() => {
    activityApi
      .published()
      .then((rows) => setActivityNames(Object.fromEntries(rows.map((a) => [a.key, a.name]))))
      .catch(() => setActivityNames({}))
  }, [])

  const activityLabel = (key: string) => activityNames[key] ?? key.replace(/_/g, ' ')

  const engines = readEngines(form.engineKinds)
  const chosenRole = roles.find((r) => r.key === form.roleKey) ?? null
  const role = (chosenRole?.baseRole ?? form.role ?? 'AGENT') as Role

  const scope = chosenRole?.scope ?? null
  const scopedToActivities = scope ? scope.activities === 'ASSIGNED' : false
  const needsKiosk = scope ? scope.terminals === 'ASSIGNED' && scope.resources !== 'NONE' : false

  /*
   * Which counters this person could stand at.
   *
   * A counter that names no built-in engine is open to any job — which is every counter for a
   * tenant that runs only its own activities. Filtering on the engine, as this did, hid every
   * WIQAR counter from every WIQAR employee.
   */
  const kiosksHere = kiosksByStation.filter(
    (k) => k.stationId === form.stationId && (!k.engineKind || !engines.length || engines.includes(k.engineKind)),
  )

  /*
   * A mobility agent answers for a gate as well as for their bay.
   *
   * These are two different places and the form must read that way. The bay is where they hand
   * over scooters; the gate is the locker hall beside it, and the reason they are the one who
   * retrieves a customer's bags — the Shop & Drop counter that sold the storage is elsewhere and
   * holds no lockers at all. Nothing about their existing desk changes.
   */
  const needsGate = role === 'AGENT' && engines.includes('MOBILITY')
  const gatesHere = gatesByStation.filter((g) => g.stationId === form.stationId)

  useEffect(() => {
    if (!needsGate) return
    if (form.gateId && gatesHere.some((g) => g.value === form.gateId)) return
    setForm((prev) => ({ ...prev, gateId: gatesHere[0]?.value ?? '' }))
  }, [needsGate, form.stationId, form.gateId, gatesHere])

  useEffect(() => {
    if (!needsKiosk) return
    if (form.kioskId && kiosksHere.some((k) => k.value === form.kioskId)) return
    setForm((prev) => ({ ...prev, kioskId: kiosksHere[0]?.value ?? '' }))
  }, [needsKiosk, form.stationId, form.kioskId, form.engineKinds, kiosksHere])

  useEffect(() => {
    if (!scopedToActivities) return
    /*
     * Somebody who answers for one counter works one built-in engine.
     *
     * The only rule left here that is genuinely the platform's. What used to sit beside it —
     * "a chief captain works the lagoon" — was one tenant's business, and now lives in that
     * tenant's own job definition.
     */
    const trimmed = needsKiosk && engines.length > 1 ? engines.slice(0, 1) : engines
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
      gateId: '',
      engineKinds: '',
      activityKeys: '',
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
      gateId: u.gateId ?? '',
      engineKinds: (u.engineKinds ?? []).join(','),
      activityKeys: (u.activityKeys ?? []).join(','),
      reportsTo: u.reportsTo ?? '',
      phone: u.phone ?? '',
    })
    setEditing(u)
  }

  const missingStation = !form.stationId
  /*
   * Assigned to something, of either kind.
   *
   * Requiring a built-in engine kind would refuse somebody hired onto an activity their own
   * company defined — which is the whole point of defining one.
   */
  const missingActivity =
    scopedToActivities && engines.length === 0 && readKeys(form.activityKeys).length === 0
  const missingGate = needsGate && !form.gateId
  const canSubmitCreate =
    !!form.fullName?.trim() &&
    !!form.email?.trim() &&
    !missingStation &&
    !missingActivity &&
    !(needsKiosk && !form.kioskId) &&
    !missingGate
  const canSubmitEdit = !missingStation && !missingActivity && !(needsKiosk && !form.kioskId) && !missingGate

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
        gateId: needsGate ? form.gateId : null,
        engineKinds: engines,
        activityKeys: readKeys(form.activityKeys),
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
        gateId: needsGate ? form.gateId : null,
          engineKinds: engines,
          activityKeys: readKeys(form.activityKeys),
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
              /* The company's own jobs, not the platform's list of nine. */
              filter: {
                kind: 'select',
                options: roles.map((r) => ({ label: r.label, value: r.key })),
                value: (r) => r.roleKey ?? '',
              },
              render: (r) => (
                <Badge tone="neutral">
                  {roles.find((x) => x.key === r.roleKey)?.label ?? t(`common:role.${r.role}`)}
                </Badge>
              ),
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
              /*
               * Both kinds of activity, from what this company actually has.
               *
               * Built-in engines only where somebody works one, and the tenant's own
               * activities beside them — so a WIQAR filter lists horse rides and a WAYZ one
               * lists the lagoon, from the same code.
               */
              filter: {
                kind: 'select',
                options: [
                  ...[...new Set(staff.flatMap((x) => x.engineKinds ?? []))].map((value) => ({
                    label: engineLabel(value),
                    value,
                  })),
                  ...[...new Set(staff.flatMap((x) => x.activityKeys ?? []))].map((value) => ({
                    label: activityLabel(value),
                    value,
                  })),
                ],
                value: (r) => [...(r.engineKinds ?? []), ...(r.activityKeys ?? [])].join(','),
              },
              /*
               * Both kinds of assignment, because a person has one kind or the other.
               *
               * Reading only `engineKinds` said "All" for every employee of a company that runs
               * its own activities — so a horse trainer assigned to exactly three things was
               * listed as working everything, which is the opposite of true and exactly the
               * sort of thing somebody would act on.
               */
              render: (r) => {
                const assigned = [
                  ...(r.engineKinds ?? []).map((k) => ({ key: k, label: engineLabel(k) })),
                  ...(r.activityKeys ?? []).map((k) => ({ key: k, label: activityLabel(k) })),
                ]
                if (assigned.length === 0) return <span className="text-muted">{t('common:table.all')}</span>
                return (
                  <div className="flex flex-wrap gap-1">
                    {assigned.map((a) => (
                      <Badge key={a.key} tone="info">{a.label}</Badge>
                    ))}
                  </div>
                )
              },
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
                  <Button variant="ghost" onClick={(e) => { e.stopPropagation(); setRemoving(r) }} title={t('common:action.delete')} data-testid={`team-remove-${r._id}`}><Trash2 size={14} /></Button>
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
        <StaffFields form={form} setForm={setForm} stations={stations} kiosks={kiosksHere} gates={gatesHere} leads={leadOptions} />
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
        <StaffFields form={form} setForm={setForm} stations={stations} kiosks={kiosksHere} gates={gatesHere} leads={leadOptions} />
      </Modal>

      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={t('team.remove.title', { name: removing?.fullName ?? '' })}
        subtitle={t('team.remove.subtitle')}
        testId="team-remove-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>{t('common:action.cancel')}</Button>
            <Button
              variant="danger"
              loading={removeStaff.isPending}
              onClick={() =>
                removing &&
                removeStaff.mutate(removing._id, {
                  onSuccess: () => {
                    toast('warning', t('team.remove.done', { name: removing.fullName }))
                    setRemoving(null)
                  },
                  onError: (e) => toast('danger', t('team.remove.refused'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
                })
              }
              data-testid="team-remove-submit"
            >
              {t('common:action.delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{t('team.remove.body')}</p>
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
  gates,
  leads,
}: {
  form: Record<string, string>
  setForm: (f: Record<string, string>) => void
  stations: { label: string; value: string }[]
  kiosks: { label: string; value: string }[]
  gates: { label: string; value: string }[]
  leads: { label: string; value: string }[]
}) {
  const { t } = useTranslation(['manager', 'common'])

  /*
   * Everything this form offers comes from the signed-in company.
   *
   * It used to come from constants: nine role names the platform compiled in, and three
   * activities that were one tenant's. A company running horse tours was therefore asked to
   * choose between Shop & Drop, Mobility Rentals and Lagoon — none of which it has, can staff
   * or will ever sell. The jobs, the activities, and which of them go together are all read
   * from the tenant now, so a newly published activity is assignable with no release.
   */
  const [roles, setRoles] = useState<TenantRole[] | null>(null)
  const [assignable, setAssignable] = useState<Assignable | null>(null)

  useEffect(() => {
    roleApi
      .list()
      .then((rows) => setRoles(rows.filter((r) => r.active)))
      .catch(() => setRoles([]))
  }, [])

  const roleKey = form.roleKey ?? ''
  const chosenRole = (roles ?? []).find((r) => r.key === roleKey) ?? null

  useEffect(() => {
    if (!roleKey) {
      setAssignable(null)
      return
    }
    let live = true
    roleApi
      .assignable(roleKey)
      .then((a) => live && setAssignable(a))
      .catch(() => live && setAssignable(null))
    return () => {
      live = false
    }
  }, [roleKey])

  const roleOptions = (roles ?? []).map((r) => ({ label: r.label, value: r.key }))

  /*
   * The platform primitive follows the job, rather than being chosen beside it.
   *
   * A tenant admin picks "Horse trainer"; whether that is a desk worker or a floor lead is a
   * property of the job they already defined, not a second question to answer.
   */
  const role = (chosenRole?.baseRole ?? form.role ?? 'AGENT') as Role
  const engines = readEngines(form.engineKinds)

  const scope = assignable?.scope ?? chosenRole?.scope ?? null
  const needsKiosk = scope ? scope.terminals === 'ASSIGNED' && scope.resources !== 'NONE' : false
  const picksActivities = scope ? scope.activities === 'ASSIGNED' : false

  /** A mobility agent works a bay and answers for a locker hall. Two postings, not one. */
  const needsGate = role === 'AGENT' && engines.includes('MOBILITY')

  const ownChosen = readKeys(form.activityKeys)

  /*
   * Built-in engines appear only where the tenant's own job says it works one.
   *
   * That is the whole fix for the reported symptom: WIQAR's jobs name no engine, so WIQAR's
   * employee form offers none.
   */
  const engineOptions = (assignable?.engineKinds ?? []).map((value) => ({
    label: engineLabel(value as EngineKind),
    value: value as EngineKind,
  }))
  const oneActivityOnly = needsKiosk
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })
  return (
    <>
      <Field label={t('common:field.fullName')} required><input className="lf-input" value={form.fullName ?? ''} onChange={set('fullName')} data-testid="team-name" /></Field>
      <Field label={t('common:field.email')} required hint={t('manager:team.emailHint')}>
        <input type="email" className="lf-input" value={form.email ?? ''} onChange={set('email')} data-testid="team-email" />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field
          label={t('common:field.role')}
          required
          hint={chosenRole?.description || undefined}
          error={
            roles && roles.length === 0
              ? 'No jobs are defined yet. Define one under Roles before hiring anybody.'
              : undefined
          }
        >
          <Select
            value={roleKey}
            onChange={(v) => {
              /*
               * Changing the job clears what the previous one was posted to.
               *
               * A counter that made sense for a shop cashier is meaningless for a horse
               * trainer, and silently keeping it is how somebody ends up posted somewhere
               * their job cannot work.
               */
              const next = (roles ?? []).find((r) => r.key === v)
              setForm({
                ...form,
                roleKey: v,
                role: next?.baseRole ?? form.role,
                kioskId: '',
                gateId: '',
                activityKeys: '',
                engineKinds: '',
              })
            }}
            options={roleOptions}
            testId="team-role"
          />
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
      {engineOptions.length > 0 && (
        <Field
          label={t('common:field.activities')}
          hint={t('team.activitiesHint')}
        >
          <div className="flex flex-wrap gap-2" data-testid="team-activities">
            {engineOptions.map((opt) => {
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
                      gateId: '',
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

      {/*
        * Activities this company defined for itself.
        *
        * Shown only when there are any, so a tenant that has not defined one sees no empty
        * section — and shown separately from the platform's own, because they are a different
        * kind of thing rather than more of the same list.
        */}
      {picksActivities && (assignable?.activities.length ?? 0) > 0 && (
        <Field
          label={t('common:field.ownActivities', { defaultValue: 'Activities' })}
          hint={t('team.ownActivitiesHint', {
            defaultValue: 'They see the resources of the activities they are assigned to, at the locations they work.',
          })}
        >
          <div className="flex flex-wrap gap-2" data-testid="team-own-activities">
            {(assignable?.activities ?? []).map((a) => {
              const on = ownChosen.includes(a.key)
              return (
                <button
                  key={a.key}
                  type="button"
                  data-testid={`team-own-activity-${a.key}`}
                  aria-pressed={on}
                  onClick={() =>
                    setForm({
                      ...form,
                      activityKeys: (on ? ownChosen.filter((k) => k !== a.key) : [...ownChosen, a.key]).join(','),
                    })
                  }
                  className={clsx(
                    'px-3 py-2 rounded-xl2 text-sm font-semibold border transition-colors inline-flex items-center gap-1.5',
                    on
                      ? 'bg-brand text-white border-brand'
                      : 'bg-white dark:bg-dk-surface text-navy dark:text-dk-texthi border-line dark:border-dk-line hover:border-brand',
                  )}
                >
                  {a.emoji && <span>{a.emoji}</span>}
                  {a.name}
                </button>
              )
            })}
          </div>
        </Field>
      )}

      {picksActivities && assignable && assignable.activities.length === 0 && (
        <Field label={t('common:field.ownActivities', { defaultValue: 'Activities' })}>
          <p className="text-sm text-muted" data-testid="team-no-activities">
            No published activity accepts <strong>{assignable.roleLabel}</strong> as an operator yet. Publish one, or
            add this job to an activity's operators, and it will appear here.
          </p>
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
      {needsGate && (
        <Field
          label={t('common:field.gate')}
          required
          hint={t('team.gateHint')}
          error={gates.length === 0 ? t('team.noGateAtStation') : undefined}
        >
          <Select value={form.gateId ?? ''} onChange={(v) => setForm({ ...form, gateId: v })} options={gates} testId="team-gate" />
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
