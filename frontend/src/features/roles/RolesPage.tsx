import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, Plus, Save, ShieldCheck, Trash2, X } from 'lucide-react'

import { ApiError } from '@/api/client'
import { roleApi, type PermissionDef, type RoleDefinition, type RoleScope, type RoleVocabulary } from '@/api/role.api'
import { activityApi, type PublishedActivity } from '@/api/activity.api'
import { PageHeader } from '@/components/PageHeader'
import { Button, Card, EmptyState, Field, Spinner } from '@/components/ui'
import { Select } from '@/components/Select'
import { toast } from '@/state/toastStore'

/**
 * Jobs, as this company defines them.
 *
 * The screen that makes the corrected model usable. A job is a name, a set of permission
 * primitives, how far it can see on each axis, and which activities it may work — composed by
 * the company that will fill it, not handed down by the platform.
 *
 * Two companies may both have a job called "Accountant" and mean entirely different things by
 * it. That is the point, and this is where the difference is written.
 */

const SCOPE_HELP: Record<keyof RoleScope, { label: string; blurb: string; options: { value: string; label: string }[] }> = {
  sites: {
    label: 'Locations',
    blurb: 'Everywhere the company operates, or only where this person is posted.',
    options: [
      { value: 'ASSIGNED', label: 'Only where they are posted' },
      { value: 'ALL', label: 'Every location' },
    ],
  },
  areas: {
    label: 'Areas',
    blurb: 'The operational areas within those locations.',
    options: [
      { value: 'ASSIGNED', label: 'Only their own area' },
      { value: 'ALL', label: 'Every area' },
    ],
  },
  terminals: {
    label: 'Counters',
    blurb: 'A job posted to a counter is asked for one when somebody is hired into it.',
    options: [
      { value: 'ASSIGNED', label: 'One counter of their own' },
      { value: 'ALL', label: 'Every counter' },
    ],
  },
  activities: {
    label: 'Activities',
    blurb: 'Named when they are hired, or all of them.',
    options: [
      { value: 'ASSIGNED', label: 'Only the ones they are assigned' },
      { value: 'ALL', label: 'Every activity' },
    ],
  },
  resources: {
    label: 'Resources',
    blurb: 'What they can see and put to work — the single most consequential setting here.',
    options: [
      { value: 'BY_ACTIVITY', label: 'The resources of the activities they work' },
      { value: 'ASSIGNED', label: 'Only what stands at their counter' },
      { value: 'ALL', label: 'Everything the company has' },
      { value: 'NONE', label: 'None at all' },
    ],
  },
}

const blank = (baseRole: string) => ({
  key: '',
  label: '',
  labelAr: '',
  description: '',
  baseRole,
  permissions: [] as string[],
  scope: { sites: 'ASSIGNED', areas: 'ASSIGNED', terminals: 'ASSIGNED', activities: 'ASSIGNED', resources: 'BY_ACTIVITY' } as RoleScope,
  activityAccess: [] as string[],
  engineAccess: [] as string[],
})

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)

export function RolesPage() {
  const { t } = useTranslation(['manager', 'common'])

  const [roles, setRoles] = useState<RoleDefinition[] | null>(null)
  const [vocab, setVocab] = useState<RoleVocabulary | null>(null)
  const [activities, setActivities] = useState<PublishedActivity[]>([])

  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<ReturnType<typeof blank> | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    roleApi.list().then(setRoles).catch(() => setRoles([]))
    roleApi.vocabulary().then(setVocab).catch(() => setVocab(null))
    activityApi.published().then(setActivities).catch(() => setActivities([]))
  }, [])

  useEffect(load, [load])

  const grouped = useMemo(() => {
    const by = new Map<string, PermissionDef[]>()
    for (const p of vocab?.permissions ?? []) by.set(p.group, [...(by.get(p.group) ?? []), p])
    return by
  }, [vocab])

  const open = (role: RoleDefinition | null) => {
    setEditing(role?.key ?? '__new__')
    setDraft(
      role
        ? {
            key: role.key,
            label: role.label,
            labelAr: role.labelAr,
            description: role.description,
            baseRole: role.baseRole,
            permissions: [...role.permissions],
            scope: { ...role.scope },
            activityAccess: [...role.activityAccess],
            engineAccess: [...role.engineAccess],
          }
        : blank(vocab?.baseRoles[0] ?? 'AGENT'),
    )
  }

  const save = async () => {
    if (!draft) return
    setBusy(true)
    try {
      if (editing === '__new__') {
        await roleApi.create({ ...draft, key: draft.key || slug(draft.label) })
        toast('success', `${draft.label} added.`)
      } else {
        await roleApi.update(draft.key, draft)
        toast('success', `${draft.label} saved.`)
      }
      setEditing(null)
      setDraft(null)
      load()
    } catch (e) {
      toast('danger', 'That could not be saved', e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : '')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (role: RoleDefinition) => {
    setBusy(true)
    try {
      await roleApi.remove(role.key)
      toast('success', `${role.label} removed.`)
      load()
    } catch (e) {
      toast('danger', 'That could not be removed', e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : '')
    } finally {
      setBusy(false)
    }
  }

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value]

  if (!roles || !vocab) {
    return (
      <div className="p-6 flex justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1100px]" data-testid="roles-page">
      <PageHeader
        title={t('roles.title', { defaultValue: 'Roles' })}
        subtitle={t('roles.subtitle', {
          defaultValue:
            'What each job in this company may do, and how far it can see. Two companies may share a job’s name and mean different things by it.',
        })}
        crumbs={[{ label: t('common:crumb.home'), to: '/dashboard' }, { label: 'Roles' }]}
        actions={
          <Button onClick={() => open(null)} data-testid="role-new">
            <Plus size={16} /> New role
          </Button>
        }
      />

      {roles.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={24} />}
          title="No jobs defined yet"
          message="A job is a set of permissions, a scope and the activities it may work. Define the ones this company actually has."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {roles.map((role) => (
            <Card key={role._id} className="p-4" data-testid={`role-${role.key}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-navy dark:text-dk-texthi flex items-center gap-2">
                    {role.label}
                    {role.system && (
                      <span
                        title="Part of how this company is administered"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted"
                      >
                        <Lock size={11} /> system
                      </span>
                    )}
                  </p>
                  {role.labelAr && (
                    <p className="text-sm text-muted" dir="rtl">
                      {role.labelAr}
                    </p>
                  )}
                  {role.description && <p className="text-[13px] text-muted mt-1 max-w-2xl">{role.description}</p>}
                  <p className="text-[12px] text-muted mt-1.5">
                    {role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'} · resources:{' '}
                    {SCOPE_HELP.resources.options.find((o) => o.value === role.scope.resources)?.label.toLowerCase()}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="secondary" onClick={() => open(role)} data-testid={`role-edit-${role.key}`}>
                    Edit
                  </Button>
                  {!role.system && (
                    <Button variant="ghost" onClick={() => remove(role)} data-testid={`role-remove-${role.key}`}>
                      <Trash2 size={15} />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDraft(null)} />
          <div className="relative w-full max-w-3xl my-8 rounded-card bg-surface shadow-pop p-5" data-testid="role-editor">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="font-bold text-lg text-navy dark:text-dk-texthi">
                  {editing === '__new__' ? 'New role' : draft.label}
                </h2>
                <p className="text-[13px] text-muted">
                  Permissions are the platform's. What this job holds is yours.
                </p>
              </div>
              <button onClick={() => setDraft(null)} aria-label="Close" className="text-muted hover:text-navy">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-x-4 sm:grid-cols-2">
              <Field label="Name" required>
                <input
                  className="lf-input"
                  value={draft.label}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  data-testid="role-label"
                />
              </Field>
              <Field label="Name in Arabic">
                <input
                  className="lf-input"
                  dir="rtl"
                  value={draft.labelAr}
                  onChange={(e) => setDraft({ ...draft, labelAr: e.target.value })}
                  data-testid="role-label-ar"
                />
              </Field>
            </div>

            <Field label="What this job does" hint="Shown to whoever is hiring, so it should say what the person is for.">
              <input
                className="lf-input"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                data-testid="role-description"
              />
            </Field>

            <div className="grid gap-x-4 sm:grid-cols-2">
              <Field
                label="Key"
                hint={editing === '__new__' ? 'Employees reference the job by this, so it cannot change later.' : 'Fixed.'}
              >
                <input
                  className="lf-input font-mono"
                  value={draft.key || slug(draft.label)}
                  readOnly={editing !== '__new__'}
                  onChange={(e) => setDraft({ ...draft, key: e.target.value })}
                  data-testid="role-key"
                />
              </Field>
              <Field
                label="Shape"
                hint="What kind of job this is to the platform — a counter worker, a floor lead, a back office. Not a source of permission."
              >
                <Select
                  value={draft.baseRole}
                  onChange={(v) => setDraft({ ...draft, baseRole: v })}
                  options={vocab.baseRoles.map((value) => ({ label: value.replace(/_/g, ' ').toLowerCase(), value }))}
                  testId="role-base"
                />
              </Field>
            </div>

            {/* ------------------------------------------------------------ scope */}
            <h3 className="lf-label mt-4">How far it can see</h3>
            <div className="grid gap-x-4 sm:grid-cols-2">
              {(Object.keys(SCOPE_HELP) as (keyof RoleScope)[]).map((axis) => (
                <Field key={axis} label={SCOPE_HELP[axis].label} hint={SCOPE_HELP[axis].blurb}>
                  <Select
                    value={draft.scope[axis]}
                    onChange={(v) => setDraft({ ...draft, scope: { ...draft.scope, [axis]: v } as RoleScope })}
                    options={SCOPE_HELP[axis].options}
                    testId={`role-scope-${axis}`}
                  />
                </Field>
              ))}
            </div>

            {/* ------------------------------------------------------- activities */}
            {activities.length > 0 && (
              <Field
                label="Activities this job may work"
                hint="Leave all unticked to allow any activity the company publishes."
              >
                <div className="flex flex-wrap gap-2" data-testid="role-activities">
                  {activities.map((a) => {
                    const on = draft.activityAccess.includes(a.key)
                    return (
                      <button
                        key={a.key}
                        type="button"
                        aria-pressed={on}
                        data-testid={`role-activity-${a.key}`}
                        onClick={() => setDraft({ ...draft, activityAccess: toggle(draft.activityAccess, a.key) })}
                        className={
                          on
                            ? 'px-3 py-2 rounded-xl2 text-sm font-semibold bg-brand text-white border border-brand'
                            : 'px-3 py-2 rounded-xl2 text-sm font-semibold bg-surface border border-line hover:border-brand'
                        }
                      >
                        {a.emoji && <span className="me-1">{a.emoji}</span>}
                        {a.name}
                      </button>
                    )
                  })}
                </div>
              </Field>
            )}

            {/* ------------------------------------------------------ permissions */}
            <h3 className="lf-label mt-4">What it may do</h3>
            <div className="space-y-3 max-h-[340px] overflow-y-auto pe-1" data-testid="role-permissions">
              {[...grouped.entries()].map(([group, perms]) => (
                <div key={group}>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">{group}</p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {perms.map((p) => (
                      <label
                        key={p.key}
                        className="flex items-start gap-2 text-[13px] text-navy dark:text-dk-text p-1.5 rounded-lg hover:bg-canvas cursor-pointer"
                        title={p.blurb}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={draft.permissions.includes(p.key)}
                          onChange={() => setDraft({ ...draft, permissions: toggle(draft.permissions, p.key) })}
                          data-testid={`role-perm-${p.key}`}
                        />
                        <span>
                          {p.label}
                          <span className="block text-[11px] text-muted font-mono">{p.key}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button onClick={save} loading={busy} disabled={!draft.label.trim()} data-testid="role-save">
                <Save size={16} /> Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
