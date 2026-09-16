import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Check, Plus } from 'lucide-react'
import { clsx } from 'clsx'

import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, EmptyState, Field, SectionTitle, Spinner } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { platformApi, type CatalogueActivity, type PlatformOrganisation } from '@/api/platform.api'
import type { EngineKind } from '@/api/types'

/**
 * The companies on this deployment, and what each of them runs.
 *
 * ## Adoption, not authoring
 *
 * The activity list on this page is fixed: it is every activity the platform has *coded*. A
 * platform administrator ticks which of them a company runs, and that is the whole of it.
 * There is deliberately no way here to define an activity, edit a workflow, add a condition or
 * build a form — those are developer work, in the same sense that Shop & Drop and Lagoon are.
 *
 * So this screen is a set of checkboxes over a catalogue, and adding activity number twelve
 * means writing it, not configuring it.
 */

interface Draft {
  id: string
  name: string
  activities: EngineKind[]
  adminName: string
  adminEmail: string
  adminPassword: string
}

const EMPTY: Draft = { id: '', name: '', activities: [], adminName: '', adminEmail: '', adminPassword: '' }

export function PlatformOrganisations() {
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [error, setError] = useState('')

  const organisations = useQuery({
    queryKey: ['platform', 'organisations'],
    queryFn: () => platformApi.organisations(),
  })
  const catalogue = useQuery({ queryKey: ['platform', 'catalogue'], queryFn: () => platformApi.catalogue() })

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['platform'] })
  }

  const create = useMutation({
    mutationFn: () =>
      platformApi.createOrganisation({
        id: draft.id,
        name: draft.name,
        activities: draft.activities,
        admin: { fullName: draft.adminName, email: draft.adminEmail, password: draft.adminPassword },
      }),
    onSuccess: () => {
      setCreating(false)
      setDraft(EMPTY)
      setError('')
      refresh()
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Could not create that organisation.'),
  })

  const adopt = useMutation({
    mutationFn: ({ id, activities }: { id: string; activities: EngineKind[] }) =>
      platformApi.updateOrganisation(id, { activities }),
    onSuccess: refresh,
  })

  const activities = catalogue.data?.activities ?? []

  if (organisations.isLoading) {
    return (
      <div data-testid="platform-organisations-page">
        <PageHeader title="Organisations" subtitle="Loading…" />
        <Spinner />
      </div>
    )
  }

  const rows = organisations.data?.organisations ?? []

  return (
    <div data-testid="platform-organisations-page">
      <PageHeader
        title="Organisations"
        subtitle="Each company on this deployment, and the activities it has taken up"
        actions={
          <Button onClick={() => setCreating(true)} data-testid="new-organisation">
            <Plus size={15} />
            New organisation
          </Button>
        }
      />

      {rows.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={<Building2 size={28} />}
            title="No organisations yet"
            message="Create the first company and its administrator."
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((org) => (
            <OrganisationCard
              key={org.id}
              org={org}
              activities={activities}
              busy={adopt.isPending}
              onAdopt={(next) => adopt.mutate({ id: org.id, activities: next })}
            />
          ))}
        </div>
      )}

      <Modal
        open={creating}
        onClose={() => {
          setCreating(false)
          setError('')
        }}
        title="New organisation"
        testId="new-organisation-modal"
      >
        <div className="grid gap-3">
          <Field label="Identifier" hint="Lowercase letters, digits and hyphens. It never changes." required>
            <input
              className="lf-input"
              data-testid="new-org-id"
              value={draft.id}
              onChange={(e) => setDraft({ ...draft, id: e.target.value.toLowerCase() })}
              placeholder="north-coast"
            />
          </Field>

          <Field label="Name" required>
            <input
              className="lf-input"
              data-testid="new-org-name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="North Coast Leisure"
            />
          </Field>

          <div>
            <SectionTitle>Activities</SectionTitle>
            <p className="mb-2 text-[12px] text-muted">
              Which of the coded activities this company runs. It can be changed later.
            </p>
            <ActivityPicker
              activities={activities}
              selected={draft.activities}
              onChange={(next) => setDraft({ ...draft, activities: next })}
              testIdPrefix="new-org-activity"
            />
          </div>

          <SectionTitle className="mt-2">First administrator</SectionTitle>
          <Field label="Full name" required>
            <input
              className="lf-input"
              data-testid="new-org-admin-name"
              value={draft.adminName}
              onChange={(e) => setDraft({ ...draft, adminName: e.target.value })}
            />
          </Field>
          <Field label="Email" required>
            <input
              className="lf-input"
              type="email"
              data-testid="new-org-admin-email"
              value={draft.adminEmail}
              onChange={(e) => setDraft({ ...draft, adminEmail: e.target.value })}
            />
          </Field>
          <Field
            label="Password"
            hint="At least twelve characters. Give it to them directly — it is never shown again."
            required
          >
            <input
              className="lf-input"
              type="password"
              data-testid="new-org-admin-password"
              value={draft.adminPassword}
              onChange={(e) => setDraft({ ...draft, adminPassword: e.target.value })}
            />
          </Field>

          {error && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger" data-testid="new-org-error">
              {error}
            </div>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending} data-testid="new-org-submit">
              {create.isPending ? 'Creating…' : 'Create organisation'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function OrganisationCard({
  org,
  activities,
  busy,
  onAdopt,
}: {
  org: PlatformOrganisation
  activities: CatalogueActivity[]
  busy: boolean
  onAdopt: (next: EngineKind[]) => void
}) {
  return (
    <Card className="p-4" data-testid={`org-${org.id}`}>
      <div className="flex items-start gap-3">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[13px] font-bold text-white"
          style={{ background: org.branding.primaryColor || 'var(--brand)' }}
        >
          {org.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-navy dark:text-dk-texthi">{org.name}</div>
          <div className="text-[12px] text-muted">
            {org.id} · {org.staff} people · {org.sites} location{org.sites === 1 ? '' : 's'}
          </div>
        </div>
        <Badge tone="neutral">{org.activities.length} activities</Badge>
      </div>

      <div className="mt-3 border-t border-line pt-3 dark:border-dk-line">
        <ActivityPicker
          activities={activities}
          selected={org.activities}
          disabled={busy}
          onChange={onAdopt}
          testIdPrefix={`adopt-${org.id}`}
        />
      </div>
    </Card>
  )
}

/**
 * The catalogue, as a set of toggles.
 *
 * Every registered activity is shown whether or not this company runs it — the point of the
 * control is to say which ones it runs, so hiding the unadopted would hide the choice.
 */
function ActivityPicker({
  activities,
  selected,
  onChange,
  disabled,
  testIdPrefix,
}: {
  activities: CatalogueActivity[]
  selected: EngineKind[]
  onChange: (next: EngineKind[]) => void
  disabled?: boolean
  testIdPrefix: string
}) {
  const toggle = (key: EngineKind) =>
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key])

  return (
    <div className="flex flex-wrap gap-1.5">
      {activities.map((activity) => {
        const on = selected.includes(activity.key)
        return (
          <button
            key={activity.key}
            type="button"
            disabled={disabled}
            onClick={() => toggle(activity.key)}
            title={activity.description}
            data-testid={`${testIdPrefix}-${activity.key}`}
            aria-pressed={on}
            className={clsx(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors disabled:opacity-50',
              on
                ? 'border-brand bg-brand/10 font-medium text-brand'
                : 'border-line text-muted hover:border-brand/40 hover:text-navy dark:border-dk-line dark:hover:text-dk-texthi',
            )}
          >
            {on && <Check size={12} />}
            {activity.label.en}
          </button>
        )
      })}
    </div>
  )
}
