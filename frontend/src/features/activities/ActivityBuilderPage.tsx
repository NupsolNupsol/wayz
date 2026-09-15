import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Flag,
  Play,
  Plus,
  Save,
  Trash2,
  Upload,
} from 'lucide-react'

import { ApiError } from '@/api/client'
import {
  activityApi,
  FIELD_KIND_LABEL,
  OPERATORS_FOR,
  OPERATOR_LABEL,
  ACTIVITY_FIELD_KINDS,
  type ActivityCondition,
  type ActivityDefinition,
  type ActivityDraft,
  type ActivityField,
  type ActivityFieldKind,
  type ActivityProblem,
  type ActivityRule,
  type ActivityState,
  type ActivityTransition,
  type ActivityGraphOptions,
} from '@/api/activity.api'
import { ActivityGraphTab } from './ActivityGraphTab'

/**
 * Where a manager builds an activity.
 *
 * Four things make an activity: the questions its counter asks, the conditions that have to
 * hold, the steps a booking moves through, and what it costs. Each is a tab, because they are
 * genuinely separate decisions and putting them on one page produced a form nobody could see
 * the end of.
 *
 * Nothing here is code. A condition is a field, a comparison drawn from a fixed list, and a
 * value — so a manager can express "a first-time rider goes out in a group of three or fewer"
 * without anything they type ever being executed.
 */

const TABS = [
  { key: 'form', label: 'Counter form' },
  { key: 'rules', label: 'Conditions' },
  { key: 'workflow', label: 'Workflow' },
  // Where it runs and who runs it, before what it costs — the graph is the part everything
  // else reads from, and burying it after pricing made it look optional. It is not.
  { key: 'graph', label: 'Where & who' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'history', label: 'Revisions' },
] as const
type TabKey = (typeof TABS)[number]['key']

const STAGES = [
  { key: 'DETAILS', label: 'Details' },
  { key: 'PARTICIPANTS', label: 'People' },
  { key: 'ASSETS', label: 'Assets' },
  { key: 'CHECKS', label: 'Checks' },
] as const

const input =
  'w-full h-10 px-3 rounded-lg border border-line bg-canvas text-sm text-ink outline-none focus:border-brand'
const select = `${input} pe-8`
const label = 'block text-[11px] font-semibold uppercase tracking-wide text-muted mb-1'

/**
 * Fixes a draft that says one thing and stores another.
 *
 * An activity charged by time with no unit recorded reads as complete on screen — the picker
 * showed a default it had never written — and is then refused on publish. Repairing it here
 * means opening the activity is enough to make the next save correct, rather than requiring
 * somebody to work out which untouched field to touch.
 */
function repair(draft: ActivityDraft): ActivityDraft {
  if (draft.pricing.billingModel === 'DURATION_BASED' && !draft.pricing.durationUnit) {
    return { ...draft, pricing: { ...draft.pricing, durationUnit: 'HOUR' } }
  }
  return draft
}

const keyFrom = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'field'

export function ActivityBuilderPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const [doc, setDoc] = useState<ActivityDefinition | null>(null)
  const [draft, setDraft] = useState<ActivityDraft | null>(null)
  /** The tenant's own locations, jobs and things. Fetched once; none of it changes here. */
  const [graph, setGraph] = useState<ActivityGraphOptions | null>(null)
  const [tab, setTab] = useState<TabKey>('form')

  const [problems, setProblems] = useState<ActivityProblem[]>([])
  const [publishable, setPublishable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(() => {
    activityApi
      .detail(id)
      .then((d) => {
        setDoc(d)
        setDraft(repair(structuredClone(d.draft)))
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'That activity could not be loaded.'))
  }, [id])

  useEffect(load, [load])

  useEffect(() => {
    activityApi
      .vocabulary()
      .then((v) => setGraph(v.graph))
      .catch(() => setGraph(null))
  }, [])

  const recheck = useCallback(() => {
    activityApi
      .check(id)
      .then((r) => {
        setProblems(r.problems)
        setPublishable(r.publishable)
      })
      .catch(() => undefined)
  }, [id])

  useEffect(() => {
    if (doc) recheck()
  }, [doc, recheck])

  const dirty = useMemo(
    () => !!doc && !!draft && JSON.stringify(draft) !== JSON.stringify(doc.draft),
    [doc, draft],
  )

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-rose-600">{error}</p>
      </div>
    )
  }
  if (!doc || !draft) {
    return (
      <div className="p-6 space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-2xl bg-canvas animate-pulse" />
        ))}
      </div>
    )
  }

  const edit = (patch: Partial<ActivityDraft>) => setDraft({ ...draft, ...patch })

  const save = async () => {
    setBusy(true)
    setMessage('')
    try {
      const next = await activityApi.saveDraft(id, draft)
      setDoc(next)
      setDraft(structuredClone(next.draft))
      setMessage('Saved.')
      recheck()
    } catch (e) {
      setMessage(e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : 'That could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const publish = async () => {
    setBusy(true)
    setMessage('')
    try {
      if (dirty) await activityApi.saveDraft(id, draft)
      const next = await activityApi.publish(id, note)
      setDoc(next)
      setDraft(structuredClone(next.draft))
      setNote('')
      setMessage(`Published as revision ${next.currentRevision}. Bookings already sold are untouched.`)
      recheck()
    } catch (e) {
      setMessage(e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : 'That could not be published.')
    } finally {
      setBusy(false)
    }
  }

  /* ---------------------------------------------------------------- fields */

  const addField = () => {
    const n = draft.fields.length + 1
    const field: ActivityField = {
      key: `field_${n}`,
      label: `Question ${n}`,
      labelAr: '',
      kind: 'TEXT',
      required: false,
      helpText: '',
      helpTextAr: '',
      options: [],
      min: null,
      max: null,
      step: null,
      assetTypeId: null,
      stage: 'DETAILS',
      order: n,
    }
    edit({ fields: [...draft.fields, field] })
  }

  const setField = (i: number, patch: Partial<ActivityField>) =>
    edit({ fields: draft.fields.map((f, x) => (x === i ? { ...f, ...patch } : f)) })

  const moveField = (i: number, by: number) => {
    const next = [...draft.fields]
    const to = i + by
    if (to < 0 || to >= next.length) return
    ;[next[i], next[to]] = [next[to], next[i]]
    edit({ fields: next.map((f, x) => ({ ...f, order: x })) })
  }

  /* ----------------------------------------------------------------- rules */

  const addRule = () => {
    const rule: ActivityRule = {
      key: `rule_${draft.rules.length + 1}`,
      message: '',
      messageAr: '',
      conditions: draft.fields[0]
        ? [{ field: draft.fields[0].key, operator: OPERATORS_FOR[draft.fields[0].kind][0], value: '', values: [] }]
        : [],
      effect: 'BLOCK',
      appliesToTransition: null,
      active: true,
    }
    edit({ rules: [...draft.rules, rule] })
  }

  const setRule = (i: number, patch: Partial<ActivityRule>) =>
    edit({ rules: draft.rules.map((r, x) => (x === i ? { ...r, ...patch } : r)) })

  const setCondition = (ri: number, ci: number, patch: Partial<ActivityCondition>) =>
    setRule(ri, {
      conditions: draft.rules[ri].conditions.map((c, x) => (x === ci ? { ...c, ...patch } : c)),
    })

  /* -------------------------------------------------------------- workflow */

  const setState = (i: number, patch: Partial<ActivityState>) =>
    edit({
      states: draft.states.map((s, x) => {
        if (x !== i) {
          // Exactly one state can be the start, so choosing a new one clears the old.
          return patch.initial ? { ...s, initial: false } : s
        }
        return { ...s, ...patch }
      }),
    })

  const setTransition = (i: number, patch: Partial<ActivityTransition>) =>
    edit({ transitions: draft.transitions.map((t, x) => (x === i ? { ...t, ...patch } : t)) })

  const problemsFor = (needle: string) =>
    problems.filter((p) => p.where.toLowerCase().includes(needle.toLowerCase()))

  return (
    <div className="p-4 sm:p-6 max-w-[1100px]" data-testid="activity-builder">
      <button
        onClick={() => navigate('/manager/activities')}
        className="text-sm text-muted hover:text-ink flex items-center gap-1.5 mb-3"
      >
        <ArrowLeft size={15} /> All activities
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-11 h-11 rounded-xl bg-brand/10 flex items-center justify-center text-xl shrink-0">
            {doc.emoji || '◆'}
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-ink truncate">{doc.name}</h1>
            <p className="text-[12px] text-muted font-mono">
              {doc.key}
              {doc.currentRevision > 0 && ` · live on revision ${doc.currentRevision}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={!dirty || busy}
            data-testid="activity-save"
            className="h-10 px-4 rounded-xl border border-line text-sm font-semibold text-ink disabled:opacity-40 inline-flex items-center gap-2"
          >
            <Save size={15} /> {dirty ? 'Save draft' : 'Saved'}
          </button>
          <button
            onClick={publish}
            disabled={!publishable || busy}
            data-testid="activity-publish"
            title={publishable ? undefined : 'Fix the problems listed below first'}
            className="h-10 px-4 rounded-xl bg-brand text-brand-fg text-sm font-semibold disabled:opacity-40 inline-flex items-center gap-2"
          >
            <Upload size={15} /> Publish
          </button>
        </div>
      </div>

      {message && (
        <div
          className="rounded-xl border border-line bg-surface p-3 mb-4 text-[13px] text-ink"
          data-testid="activity-message"
        >
          {message}
        </div>
      )}

      {problems.length > 0 ? (
        <div
          className="rounded-xl border border-amber-400/40 bg-amber-50 dark:bg-amber-500/10 p-3.5 mb-4"
          data-testid="activity-problems"
        >
          <p className="text-[13px] font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2 mb-1.5">
            <AlertTriangle size={15} /> Not publishable yet
          </p>
          <ul className="text-[12px] text-amber-800/80 dark:text-amber-200/70 space-y-1">
            {problems.map((p, i) => (
              <li key={`${p.where}-${i}`}>
                <span className="font-semibold">{p.where}</span> — {p.problem}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div
          className="rounded-xl border border-emerald-400/40 bg-emerald-50 dark:bg-emerald-500/10 p-3 mb-4 text-[13px] text-emerald-800 dark:text-emerald-200 flex items-center gap-2"
          data-testid="activity-ready"
        >
          <CheckCircle2 size={15} /> This activity is complete and can be published.
        </div>
      )}

      <div className="flex gap-1 mb-5 overflow-x-auto border-b border-line" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            data-testid={`activity-tab-${t.key}`}
            className={
              tab === t.key
                ? 'px-3.5 h-10 text-[13px] font-semibold border-b-2 border-brand text-ink whitespace-nowrap'
                : 'px-3.5 h-10 text-[13px] font-medium border-b-2 border-transparent text-muted hover:text-ink whitespace-nowrap'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------ form */}
      {tab === 'form' && (
        <div data-testid="activity-panel-form">
          <p className="text-[13px] text-muted mb-4">
            What an agent is asked at the counter, in the order they are asked it.
          </p>

          <div className="space-y-3">
            {draft.fields.map((f, i) => (
              <div key={i} className="rounded-2xl border border-line bg-surface p-4" data-testid={`field-${f.key}`}>
                <div className="flex items-start gap-2 mb-3">
                  <div className="flex flex-col gap-0.5 shrink-0 pt-1">
                    <button onClick={() => moveField(i, -1)} aria-label="Move up" className="text-muted hover:text-ink">
                      <ChevronUp size={15} />
                    </button>
                    <button onClick={() => moveField(i, 1)} aria-label="Move down" className="text-muted hover:text-ink">
                      <ChevronDown size={15} />
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 flex-1 min-w-0">
                    <label>
                      <span className={label}>Question</span>
                      <input
                        value={f.label}
                        onChange={(e) => setField(i, { label: e.target.value, key: f.key || keyFrom(e.target.value) })}
                        className={input}
                        data-testid={`field-label-${i}`}
                      />
                    </label>
                    <label>
                      <span className={label}>In Arabic</span>
                      <input value={f.labelAr} onChange={(e) => setField(i, { labelAr: e.target.value })} dir="rtl" className={input} />
                    </label>
                    <label>
                      <span className={label}>Answer type</span>
                      <select
                        value={f.kind}
                        onChange={(e) => setField(i, { kind: e.target.value as ActivityFieldKind })}
                        className={select}
                        data-testid={`field-kind-${i}`}
                      >
                        {ACTIVITY_FIELD_KINDS.map((k) => (
                          <option key={k} value={k}>
                            {FIELD_KIND_LABEL[k]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className={label}>Asked during</span>
                      <select
                        value={f.stage}
                        onChange={(e) => setField(i, { stage: e.target.value as ActivityField['stage'] })}
                        className={select}
                      >
                        {STAGES.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {f.kind === 'NUMBER' && (
                      <>
                        <label>
                          <span className={label}>Smallest</span>
                          <input
                            type="number"
                            value={f.min ?? ''}
                            onChange={(e) => setField(i, { min: e.target.value === '' ? null : Number(e.target.value) })}
                            className={input}
                          />
                        </label>
                        <label>
                          <span className={label}>Largest</span>
                          <input
                            type="number"
                            value={f.max ?? ''}
                            onChange={(e) => setField(i, { max: e.target.value === '' ? null : Number(e.target.value) })}
                            className={input}
                          />
                        </label>
                      </>
                    )}

                    {f.kind === 'SELECT' && (
                      <label className="sm:col-span-2">
                        <span className={label}>Choices, one per line</span>
                        <textarea
                          rows={3}
                          value={f.options.map((o) => o.label).join('\n')}
                          onChange={(e) =>
                            setField(i, {
                              options: e.target.value
                                .split('\n')
                                .map((s) => s.trim())
                                .filter(Boolean)
                                .map((s) => ({ value: keyFrom(s), label: s, labelAr: '' })),
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-sm text-ink outline-none focus:border-brand"
                          data-testid={`field-options-${i}`}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap ps-7">
                  <label className="flex items-center gap-2 text-[13px] text-ink">
                    <input
                      type="checkbox"
                      checked={f.required}
                      onChange={(e) => setField(i, { required: e.target.checked })}
                      data-testid={`field-required-${i}`}
                    />
                    Must be answered
                  </label>
                  <span className="text-[11px] text-muted font-mono">{f.key}</span>
                  <button
                    onClick={() => edit({ fields: draft.fields.filter((_, x) => x !== i) })}
                    className="text-[13px] text-rose-600 hover:text-rose-700 inline-flex items-center gap-1.5"
                    data-testid={`field-remove-${i}`}
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addField}
            data-testid="activity-add-field"
            className="mt-3 h-10 px-4 rounded-xl border border-dashed border-line text-sm font-semibold text-muted hover:text-ink hover:border-brand inline-flex items-center gap-2"
          >
            <Plus size={15} /> Add a question
          </button>
        </div>
      )}

      {/* ----------------------------------------------------------- rules */}
      {tab === 'rules' && (
        <div data-testid="activity-panel-rules">
          <p className="text-[13px] text-muted mb-4">
            Conditions that must hold. Each is built from the answers above — nothing here is
            code, and nothing typed into it is ever executed.
          </p>

          <div className="space-y-3">
            {draft.rules.map((r, ri) => (
              <div key={ri} className="rounded-2xl border border-line bg-surface p-4" data-testid={`rule-${ri}`}>
                <div className="grid gap-3 sm:grid-cols-2 mb-3">
                  <label className="sm:col-span-2">
                    <span className={label}>What the agent is told when it does not hold</span>
                    <input
                      value={r.message}
                      onChange={(e) => setRule(ri, { message: e.target.value })}
                      placeholder="Fit and check a helmet before the ride starts."
                      className={input}
                      data-testid={`rule-message-${ri}`}
                    />
                  </label>
                  <label>
                    <span className={label}>What happens</span>
                    <select
                      value={r.effect}
                      onChange={(e) => setRule(ri, { effect: e.target.value as ActivityRule['effect'] })}
                      className={select}
                      data-testid={`rule-effect-${ri}`}
                    >
                      <option value="BLOCK">Stop them</option>
                      <option value="WARN">Warn them</option>
                      <option value="REQUIRE_SUPERVISOR">Need a supervisor</option>
                    </select>
                  </label>
                  <label>
                    <span className={label}>Checked at</span>
                    <select
                      value={r.appliesToTransition ?? ''}
                      onChange={(e) => setRule(ri, { appliesToTransition: e.target.value || null })}
                      className={select}
                      data-testid={`rule-when-${ri}`}
                    >
                      <option value="">the sale itself</option>
                      {draft.transitions.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="space-y-2">
                  {r.conditions.map((c, ci) => {
                    const field = draft.fields.find((f) => f.key === c.field)
                    const operators = field ? OPERATORS_FOR[field.kind] : OPERATORS_FOR.TEXT
                    const needsValue = ['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'GREATER_OR_EQUAL', 'LESS_THAN', 'LESS_OR_EQUAL'].includes(c.operator)
                    const needsList = ['IS_ONE_OF', 'IS_NOT_ONE_OF'].includes(c.operator)

                    return (
                      <div key={ci} className="flex flex-wrap items-end gap-2 rounded-xl bg-canvas p-2.5">
                        <select
                          value={c.field}
                          onChange={(e) => setCondition(ri, ci, { field: e.target.value })}
                          className={`${select} flex-1 min-w-[140px]`}
                          data-testid={`condition-field-${ri}-${ci}`}
                        >
                          {draft.fields.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label}
                            </option>
                          ))}
                        </select>

                        <select
                          value={c.operator}
                          onChange={(e) => setCondition(ri, ci, { operator: e.target.value as ActivityCondition['operator'] })}
                          className={`${select} flex-1 min-w-[140px]`}
                          data-testid={`condition-operator-${ri}-${ci}`}
                        >
                          {operators.map((o) => (
                            <option key={o} value={o}>
                              {OPERATOR_LABEL[o]}
                            </option>
                          ))}
                        </select>

                        {needsValue && (
                          <input
                            value={c.value}
                            onChange={(e) => setCondition(ri, ci, { value: e.target.value })}
                            className={`${input} flex-1 min-w-[110px]`}
                            data-testid={`condition-value-${ri}-${ci}`}
                          />
                        )}

                        {needsList && (
                          <input
                            value={c.values.join(', ')}
                            onChange={(e) =>
                              setCondition(ri, ci, {
                                values: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                              })
                            }
                            placeholder="comma separated"
                            className={`${input} flex-1 min-w-[140px]`}
                          />
                        )}

                        <button
                          onClick={() => setRule(ri, { conditions: r.conditions.filter((_, x) => x !== ci) })}
                          aria-label="Remove condition"
                          className="text-muted hover:text-rose-600 pb-2.5"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>

                <div className="flex items-center justify-between mt-3">
                  <button
                    onClick={() =>
                      draft.fields[0] &&
                      setRule(ri, {
                        conditions: [
                          ...r.conditions,
                          { field: draft.fields[0].key, operator: OPERATORS_FOR[draft.fields[0].kind][0], value: '', values: [] },
                        ],
                      })
                    }
                    className="text-[13px] text-brand font-semibold inline-flex items-center gap-1.5"
                    data-testid={`rule-add-condition-${ri}`}
                  >
                    <Plus size={14} /> And…
                  </button>
                  <button
                    onClick={() => edit({ rules: draft.rules.filter((_, x) => x !== ri) })}
                    className="text-[13px] text-rose-600 inline-flex items-center gap-1.5"
                  >
                    <Trash2 size={14} /> Remove rule
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addRule}
            disabled={draft.fields.length === 0}
            title={draft.fields.length === 0 ? 'Add a question first — a rule tests an answer' : undefined}
            data-testid="activity-add-rule"
            className="mt-3 h-10 px-4 rounded-xl border border-dashed border-line text-sm font-semibold text-muted hover:text-ink hover:border-brand inline-flex items-center gap-2 disabled:opacity-40"
          >
            <Plus size={15} /> Add a condition
          </button>
        </div>
      )}

      {/* -------------------------------------------------------- workflow */}
      {tab === 'workflow' && (
        <div data-testid="activity-panel-workflow">
          <p className="text-[13px] text-muted mb-4">
            The states a booking moves through, and the steps that move it. One state is where
            bookings start; at least one must finish them.
          </p>

          <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted mb-2">States</h2>
          <div className="space-y-2 mb-6">
            {draft.states.map((s, i) => (
              <div key={i} className="rounded-xl border border-line bg-surface p-3 flex flex-wrap items-end gap-3" data-testid={`state-${s.key}`}>
                <label className="flex-1 min-w-[140px]">
                  <span className={label}>Name</span>
                  <input value={s.label} onChange={(e) => setState(i, { label: e.target.value })} className={input} />
                </label>
                <label className="flex-1 min-w-[120px]">
                  <span className={label}>In Arabic</span>
                  <input value={s.labelAr} onChange={(e) => setState(i, { labelAr: e.target.value })} dir="rtl" className={input} />
                </label>

                <label className="flex items-center gap-1.5 text-[12px] text-ink pb-2.5 whitespace-nowrap">
                  <input type="checkbox" checked={s.initial} onChange={(e) => setState(i, { initial: e.target.checked })} data-testid={`state-initial-${s.key}`} />
                  <Play size={12} /> starts here
                </label>
                <label className="flex items-center gap-1.5 text-[12px] text-ink pb-2.5 whitespace-nowrap">
                  <input type="checkbox" checked={s.inProgress} onChange={(e) => setState(i, { inProgress: e.target.checked })} />
                  running
                </label>
                <label className="flex items-center gap-1.5 text-[12px] text-ink pb-2.5 whitespace-nowrap">
                  <input type="checkbox" checked={s.terminal} onChange={(e) => setState(i, { terminal: e.target.checked })} data-testid={`state-terminal-${s.key}`} />
                  <Flag size={12} /> finished
                </label>

                <button
                  onClick={() => edit({ states: draft.states.filter((_, x) => x !== i) })}
                  aria-label="Remove state"
                  className="text-muted hover:text-rose-600 pb-2.5"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() =>
              edit({
                states: [
                  ...draft.states,
                  {
                    key: `state_${draft.states.length + 1}`,
                    label: `State ${draft.states.length + 1}`,
                    labelAr: '',
                    initial: false,
                    terminal: false,
                    inProgress: false,
                    colour: '',
                    order: draft.states.length,
                  },
                ],
              })
            }
            data-testid="activity-add-state"
            className="mb-6 h-9 px-3.5 rounded-xl border border-dashed border-line text-[13px] font-semibold text-muted hover:text-ink hover:border-brand inline-flex items-center gap-2"
          >
            <Plus size={14} /> Add a state
          </button>

          <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted mb-2">Steps</h2>
          <div className="space-y-2">
            {draft.transitions.map((t, i) => (
              <div key={i} className="rounded-xl border border-line bg-surface p-3 flex flex-wrap items-end gap-3" data-testid={`transition-${t.key}`}>
                <label className="flex-1 min-w-[150px]">
                  <span className={label}>Button the agent presses</span>
                  <input value={t.label} onChange={(e) => setTransition(i, { label: e.target.value })} className={input} />
                </label>
                <label className="min-w-[120px]">
                  <span className={label}>From</span>
                  <select value={t.from} onChange={(e) => setTransition(i, { from: e.target.value })} className={select}>
                    {draft.states.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-[120px]">
                  <span className={label}>To</span>
                  <select value={t.to} onChange={(e) => setTransition(i, { to: e.target.value })} className={select}>
                    {draft.states.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-1.5 text-[12px] text-ink pb-2.5 whitespace-nowrap">
                  <input type="checkbox" checked={t.takesPayment} onChange={(e) => setTransition(i, { takesPayment: e.target.checked })} />
                  takes payment
                </label>
                <label className="flex items-center gap-1.5 text-[12px] text-ink pb-2.5 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={t.requiresCustomerProof}
                    onChange={(e) => setTransition(i, { requiresCustomerProof: e.target.checked })}
                  />
                  needs the customer to confirm
                </label>

                <button
                  onClick={() => edit({ transitions: draft.transitions.filter((_, x) => x !== i) })}
                  aria-label="Remove step"
                  className="text-muted hover:text-rose-600 pb-2.5"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() =>
              draft.states.length >= 2 &&
              edit({
                transitions: [
                  ...draft.transitions,
                  {
                    key: `step_${draft.transitions.length + 1}`,
                    label: `Step ${draft.transitions.length + 1}`,
                    labelAr: '',
                    from: draft.states[0].key,
                    to: draft.states[1].key,
                    allowedRoles: [],
                    takesPayment: false,
                    requiresCustomerProof: false,
                    order: draft.transitions.length,
                  },
                ],
              })
            }
            disabled={draft.states.length < 2}
            data-testid="activity-add-transition"
            className="mt-3 h-9 px-3.5 rounded-xl border border-dashed border-line text-[13px] font-semibold text-muted hover:text-ink hover:border-brand inline-flex items-center gap-2 disabled:opacity-40"
          >
            <Plus size={14} /> Add a step
          </button>

          {problemsFor('workflow').length > 0 && (
            <p className="mt-3 text-[12px] text-amber-700 dark:text-amber-300">
              {problemsFor('workflow').map((p) => p.problem).join(' ')}
            </p>
          )}
        </div>
      )}

      {/* ------------------------------------------------- where & who */}
      {tab === 'graph' && <ActivityGraphTab draft={draft} graph={graph} edit={edit} />}

      {/* --------------------------------------------------------- pricing */}
      {tab === 'pricing' && (
        <div className="max-w-lg" data-testid="activity-panel-pricing">
          <p className="text-[13px] text-muted mb-4">What this activity costs, and how it is charged.</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={label}>Charged as</span>
              <select
                value={draft.pricing.billingModel}
                onChange={(e) => {
                  /*
                   * Charging by time needs a unit, so choosing "by time" chooses one.
                   *
                   * The unit picker used to default only its *display* — it showed "Hour"
                   * while the stored value was still empty — so an administrator who never
                   * touched that dropdown saved an activity the validator then refused, with
                   * a message contradicting what was plainly on their screen.
                   */
                  const billingModel = e.target.value
                  edit({
                    pricing: {
                      ...draft.pricing,
                      billingModel,
                      durationUnit:
                        billingModel === 'DURATION_BASED' ? (draft.pricing.durationUnit ?? 'HOUR') : null,
                    },
                  })
                }}
                className={select}
                data-testid="pricing-model"
              >
                <option value="PACKAGE">A fixed price</option>
                <option value="DURATION_BASED">By time</option>
              </select>
            </label>

            <label>
              <span className={label}>Price</span>
              <input
                type="number"
                min={0}
                value={draft.pricing.basePrice}
                onChange={(e) => edit({ pricing: { ...draft.pricing, basePrice: Number(e.target.value) } })}
                className={input}
                data-testid="pricing-base"
              />
            </label>

            {draft.pricing.billingModel === 'DURATION_BASED' && (
              <label>
                <span className={label}>Charged per</span>
                <select
                  value={draft.pricing.durationUnit ?? 'HOUR'}
                  onChange={(e) => edit({ pricing: { ...draft.pricing, durationUnit: e.target.value } })}
                  className={select}
                  data-testid="pricing-duration-unit"
                >
                  <option value="FIFTEEN_MIN">15 minutes</option>
                  <option value="HALF_HOUR">Half hour</option>
                  <option value="HOUR">Hour</option>
                  <option value="DAY">Day</option>
                </select>
              </label>
            )}

            <label>
              <span className={label}>Deposit</span>
              <input
                type="number"
                min={0}
                value={draft.pricing.depositRequired}
                onChange={(e) => edit({ pricing: { ...draft.pricing, depositRequired: Number(e.target.value) } })}
                className={input}
              />
            </label>

            <label>
              <span className={label}>Grace period (minutes)</span>
              <input
                type="number"
                min={0}
                value={draft.pricing.gracePeriodMin}
                onChange={(e) => edit({ pricing: { ...draft.pricing, gracePeriodMin: Number(e.target.value) } })}
                className={input}
              />
            </label>

            <label>
              <span className={label}>People per booking</span>
              <input
                type="number"
                min={1}
                value={draft.capacity.seatsPerBooking ?? ''}
                onChange={(e) =>
                  edit({
                    capacity: {
                      ...draft.capacity,
                      seatsPerBooking: e.target.value === '' ? null : Number(e.target.value),
                    },
                  })
                }
                placeholder="no limit"
                className={input}
              />
            </label>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- revisions */}
      {tab === 'history' && (
        <div data-testid="activity-panel-history">
          <p className="text-[13px] text-muted mb-4">
            Every published version, kept. A booking is always judged against the version it was
            sold under, so editing this activity can never change what a customer already bought.
          </p>

          {doc.revisions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line p-8 text-center text-[13px] text-muted">
              Nothing published yet.
            </div>
          ) : (
            <div className="space-y-2">
              {[...doc.revisions].reverse().map((r) => (
                <div
                  key={r.revision}
                  className="rounded-xl border border-line bg-surface p-3.5 flex flex-wrap items-center gap-3"
                  data-testid={`revision-${r.revision}`}
                >
                  <span className="w-9 h-9 rounded-lg bg-brand/10 text-brand font-bold flex items-center justify-center shrink-0">
                    {r.revision}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-ink">
                      {r.note || `Revision ${r.revision}`}
                      {r.revision === doc.currentRevision && (
                        <span className="ms-2 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 px-2 py-0.5 text-[11px]">
                          live
                        </span>
                      )}
                    </p>
                    <p className="text-[12px] text-muted">
                      {new Date(r.publishedAt).toLocaleString()} · {r.fields.length} questions ·{' '}
                      {r.rules.length} rules · {r.pricing.basePrice}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <label className="block mt-5 max-w-sm">
            <span className={label}>Note for the next publish</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What changed and why"
              className={input}
              data-testid="activity-publish-note"
            />
          </label>
        </div>
      )}
    </div>
  )
}
