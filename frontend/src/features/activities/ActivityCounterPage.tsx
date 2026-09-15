import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, UserPlus } from 'lucide-react'

import { ApiError } from '@/api/client'
import { activityApi, type ActivityField, type PublishedActivity } from '@/api/activity.api'
import { activitySessionApi, type ActivityStep } from '@/api/activitySession.api'
import { customerApi } from '@/api/customer.api'
import { catalogueApi } from '@/api/catalogue.api'
import { PageHeader } from '@/components/PageHeader'
import { Button, Card, EmptyState, Field, SectionTitle, Spinner } from '@/components/ui'
import { Select } from '@/components/Select'
import { toast } from '@/state/toastStore'
import type { AssetUnit, Customer } from '@/api/types'

/**
 * The counter, for an activity the company invented.
 *
 * Nothing on this screen is written for any particular business. The questions come from the
 * activity's published revision, the resources from what this person is allowed to put to
 * work, and the buttons from the steps the activity's own workflow offers next. A company that
 * adds "Sunset falconry" on a Tuesday sells it on a Tuesday, with no deployment and no code
 * here changing.
 *
 * It is the deliberate counterpart to the built-in engine screens — Shop & Drop, Mobility,
 * Lagoon — which know exactly what they are selling because the product was built around
 * those three. This one knows nothing, which is why it works for everybody else.
 */

const input =
  'w-full h-10 px-3 rounded-lg border border-line bg-canvas text-sm text-ink outline-none focus:border-brand'

/** What a blank answer looks like for each kind of question the builder can ask. */
const emptyFor = (field: ActivityField): unknown => {
  switch (field.kind) {
    case 'BOOLEAN':
      return false
    case 'NUMBER':
      return field.min ?? ''
    case 'SELECT':
      return field.options[0]?.value ?? ''
    default:
      return ''
  }
}

export function ActivityCounterPage() {
  const { key = '' } = useParams()
  const navigate = useNavigate()

  const [activity, setActivity] = useState<PublishedActivity | null>(null)
  const [loading, setLoading] = useState(true)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerId, setCustomerId] = useState('')
  const [resources, setResources] = useState<AssetUnit[]>([])
  const [resourceId, setResourceId] = useState('')

  const [values, setValues] = useState<Record<string, unknown>>({})
  const [busy, setBusy] = useState(false)

  /* Once booked, the screen becomes the thing that walks it to the end. */
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [state, setState] = useState<{ label: string; terminal: boolean } | null>(null)
  const [steps, setSteps] = useState<ActivityStep[]>([])

  /*
   * Three independent loads, deliberately not one `Promise.all`.
   *
   * They answer different questions and not everybody may ask all three — the counter
   * endpoints are agent-only, so a supervisor opening this screen is refused the resource
   * list. Bundling them meant that one refusal rejected the whole batch and the page rendered
   * "that activity is not offered here", which is both wrong and impossible to diagnose from
   * the outside. Each now fails on its own, and the page degrades to what it could load.
   */
  useEffect(() => {
    let live = true

    activityApi
      .published()
      .then((published) => {
        if (!live) return
        const found = published.find((a) => a.key === key) ?? null
        setActivity(found)
        setValues(Object.fromEntries((found?.fields ?? []).map((f) => [f.key, emptyFor(f)])))
      })
      .catch(() => live && setActivity(null))
      .finally(() => live && setLoading(false))

    customerApi
      .list()
      .then((people) => live && setCustomers(people))
      .catch(() => live && setCustomers([]))

    catalogueApi
      .units()
      .then((units) => live && setResources(units))
      .catch(() => live && setResources([]))

    return () => {
      live = false
    }
  }, [key])

  /*
   * The resources this activity uses, out of everything this person may reach.
   *
   * The list from the server is already scoped to them — their location, their activities. This
   * narrows it once more to the activity in front of them, because somebody who works three
   * activities should not be offered all three activities' resources while booking one. A named
   * list wins over the kinds, for the same reason it does on the server: naming six horses means
   * those six.
   */
  const usable = useMemo(() => {
    const kinds = activity?.assetTypeIds ?? []
    const named = activity?.eligibleResourceIds ?? []
    if (named.length) return resources.filter((r) => named.includes(r._id))
    if (kinds.length === 0) return []
    return resources.filter((r) => kinds.includes(r.assetTypeId) && r.status === 'AVAILABLE')
  }, [activity, resources])

  /*
   * Where it stands, re-read from the server after every move.
   *
   * Awaited by its callers rather than fired and forgotten, so the button stays busy until the
   * screen actually reflects what happened. Clearing it earlier leaves a window in which the
   * old step is still on screen and still clickable, which is how somebody takes the same step
   * twice.
   */
  const refreshSteps = useCallback(async (id: string) => {
    try {
      const r = await activitySessionApi.steps(id)
      setState(r.state ? { label: r.state.label, terminal: r.state.terminal } : null)
      setSteps(r.steps)
    } catch (e) {
      // Silence here would leave a session card with no buttons and no explanation.
      setSteps([])
      toast('danger', 'Could not read what happens next', e instanceof ApiError ? e.message : '')
    }
  }, [])

  const book = async () => {
    if (!activity) return
    setBusy(true)
    try {
      const { booking } = await activitySessionApi.open({
        activityKey: activity.key,
        customerId,
        resourceId: resourceId || null,
        values,
      })
      setBookingId(booking._id)
      toast('success', `${activity.name} booked`, booking.ref)
      await refreshSteps(booking._id)
    } catch (e) {
      toast('danger', 'That could not be booked', e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : '')
    } finally {
      setBusy(false)
    }
  }

  const take = async (step: ActivityStep) => {
    if (!bookingId) return
    setBusy(true)
    try {
      await activitySessionApi.step(bookingId, step.key)
      await refreshSteps(bookingId)
    } catch (e) {
      toast('danger', `Could not ${step.label.toLowerCase()}`, e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : '')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <Spinner />
      </div>
    )
  }

  if (!activity) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState
          title="That activity is not offered here"
          message="Either it is not published, or your counter is not one of the ones that sells it."
          action={<Button onClick={() => navigate('/pos')}>Back to the counter</Button>}
        />
      </div>
    )
  }

  const askedFor = [...activity.fields].sort((a, b) => a.order - b.order)

  return (
    <div className="p-4 sm:p-6 max-w-[760px]" data-testid="activity-counter">
      <PageHeader
        title={`${activity.emoji ? activity.emoji + ' ' : ''}${activity.name}`}
        subtitle={activity.description || 'Take a booking.'}
        crumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'New transaction', to: '/pos' }, { label: activity.name }]}
      />

      {bookingId ? (
        <Card className="p-5" data-testid="activity-session">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <p className="font-bold text-navy dark:text-dk-texthi">{state?.label ?? 'Booked'}</p>
          </div>
          <p className="text-[13px] text-muted mb-4">
            {state?.terminal
              ? 'This one is finished. Anything it was holding has been given back.'
              : 'What happens next, as this company defined it.'}
          </p>

          <div className="flex flex-wrap gap-2">
            {steps.map((step) => (
              <Button key={step.key} onClick={() => take(step)} loading={busy} data-testid={`activity-step-${step.key}`}>
                {step.label} <ArrowRight size={15} />
              </Button>
            ))}
            {steps.length === 0 && (
              <Button variant="secondary" onClick={() => navigate('/pos')} data-testid="activity-done">
                Take another booking
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <Card className="p-5">
          <SectionTitle>Who it is for</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 mb-5 mt-2">
            <Field label="Customer" required>
              <Select
                value={customerId}
                onChange={(v: string) => setCustomerId(v)}
                options={[
                  { label: 'Choose a customer', value: '' },
                  ...customers.map((c) => ({ label: `${c.name} · ${c.phone}`, value: c._id })),
                ]}
                testId="activity-customer"
              />
            </Field>
            <div className="flex items-end">
              <Button variant="secondary" onClick={() => navigate('/customers')} data-testid="activity-new-customer">
                <UserPlus size={15} /> Register someone
              </Button>
            </div>
          </div>

          {(activity.assetTypeIds ?? []).length > 0 && (
            <>
              <SectionTitle>What it runs on</SectionTitle>
              <div className="mb-5 mt-2">
                <Field
                  label="Resource"
                  hint={
                    usable.length === 0
                      ? 'Nothing of yours is free for this right now.'
                      : 'Only the ones at your location that this activity uses.'
                  }
                >
                  <Select
                    value={resourceId}
                    onChange={(v: string) => setResourceId(v)}
                    options={[
                      { label: 'Choose one', value: '' },
                      ...usable.map((r) => ({ label: `${r.identifier} · ${r.assetTypeName}`, value: r._id })),
                    ]}
                    testId="activity-resource"
                  />
                </Field>
              </div>
            </>
          )}

          {askedFor.length > 0 && (
            <>
              <SectionTitle>What this company asks at the counter</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2 mt-2 mb-5">
                {askedFor.map((field) => (
                  <Field key={field.key} label={field.label} hint={field.helpText} required={field.required}>
                    {field.kind === 'SELECT' ? (
                      <Select
                        value={String(values[field.key] ?? '')}
                        onChange={(v: string) => setValues({ ...values, [field.key]: v })}
                        options={field.options.map((o) => ({ label: o.label, value: o.value }))}
                        testId={`activity-field-${field.key}`}
                      />
                    ) : field.kind === 'BOOLEAN' ? (
                      <label className="flex items-center gap-2 h-10">
                        <input
                          type="checkbox"
                          checked={!!values[field.key]}
                          onChange={(e) => setValues({ ...values, [field.key]: e.target.checked })}
                          data-testid={`activity-field-${field.key}`}
                        />
                        <span className="text-sm text-muted">{field.helpText || 'Yes'}</span>
                      </label>
                    ) : (
                      <input
                        type={
                          field.kind === 'NUMBER'
                            ? 'number'
                            : field.kind === 'DATE'
                              ? 'date'
                              : field.kind === 'TIME'
                                ? 'time'
                                : 'text'
                        }
                        value={String(values[field.key] ?? '')}
                        min={field.min ?? undefined}
                        max={field.max ?? undefined}
                        onChange={(e) =>
                          setValues({
                            ...values,
                            [field.key]: field.kind === 'NUMBER' ? Number(e.target.value) : e.target.value,
                          })
                        }
                        className={input}
                        data-testid={`activity-field-${field.key}`}
                      />
                    )}
                  </Field>
                ))}
              </div>
            </>
          )}

          <div className="flex items-center justify-between gap-3 pt-4 border-t border-line">
            <p className="text-sm text-muted">
              {activity.pricing ? `${activity.pricing.basePrice} per booking` : 'No price set'}
            </p>
            <Button onClick={book} loading={busy} disabled={!customerId} data-testid="activity-book">
              Book it <ArrowRight size={15} />
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
