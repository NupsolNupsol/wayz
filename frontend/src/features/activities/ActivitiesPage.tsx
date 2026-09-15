import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Blocks, Plus, X } from 'lucide-react'

import { ApiError } from '@/api/client'
import { activityApi, type ActivityDefinition } from '@/api/activity.api'

/**
 * The activities this company runs, as records it owns.
 *
 * Until now an activity was a value in an enum and adding one meant a developer and a release.
 * A tenant defines its own here: the questions its counter asks, the conditions that have to
 * hold, the steps a booking moves through, and what it costs.
 */

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)

const STATUS: Record<string, { label: string; className: string }> = {
  PUBLISHED: { label: 'Live', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25' },
  DRAFT: { label: 'Draft', className: 'bg-amber-500/10 text-amber-600 border-amber-500/25' },
  ARCHIVED: { label: 'Archived', className: 'bg-ink/5 text-muted border-line' },
}

export function ActivitiesPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<ActivityDefinition[] | null>(null)
  const [error, setError] = useState('')

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [key, setKey] = useState('')
  const [keyTouched, setKeyTouched] = useState(false)
  const [emoji, setEmoji] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(() => {
    setError('')
    activityApi
      .list()
      .then(setRows)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'The activities could not be loaded.'))
  }, [])

  useEffect(load, [load])

  const handle = keyTouched ? key : slugify(name)
  const valid = name.trim().length >= 2 && /^[a-z][a-z0-9_]{1,40}$/.test(handle)

  const create = async () => {
    setBusy(true)
    setFormError('')
    try {
      const made = await activityApi.create({
        key: handle,
        name: name.trim(),
        nameAr: nameAr.trim() || undefined,
        emoji: emoji.trim() || undefined,
      })
      navigate(`/manager/activities/${made._id}`)
    } catch (e) {
      setFormError(e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : 'That could not be created.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1200px]" data-testid="activities-page">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-ink">Activities</h1>
          <p className="text-sm text-muted mt-0.5 max-w-2xl">
            What this company sells, and how. Each activity has its own counter form, its own
            conditions and its own workflow — all of it yours to change.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          data-testid="activity-new"
          className="h-10 px-4 rounded-xl bg-brand text-brand-fg text-sm font-semibold inline-flex items-center gap-2 hover:bg-brand-600 transition"
        >
          <Plus size={15} /> New activity
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-300/40 bg-rose-50 dark:bg-rose-500/10 p-3 mb-4 text-sm text-rose-700 dark:text-rose-200">
          {error}
        </div>
      )}

      {!rows ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[74px] rounded-2xl bg-canvas animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed border-line p-10 text-center flex flex-col items-center gap-2"
          data-testid="activities-empty"
        >
          <span className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center mb-1">
            <Blocks size={22} className="text-brand" />
          </span>
          <p className="font-semibold text-ink">No activities yet</p>
          <p className="text-sm text-muted max-w-md">
            An activity is something you sell at a counter — a ride, a session, a hire. Define
            the questions your agents ask, the conditions that must hold, and the steps a
            booking goes through.
          </p>
          <button
            onClick={() => setCreating(true)}
            className="mt-3 h-10 px-4 rounded-xl bg-brand text-brand-fg text-sm font-semibold inline-flex items-center gap-2"
          >
            <Plus size={15} /> Define the first one
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((a) => {
            const status = STATUS[a.status] ?? STATUS.DRAFT
            const unpublished = a.status === 'PUBLISHED' && a.currentRevision > 0
            return (
              <button
                key={a._id}
                onClick={() => navigate(`/manager/activities/${a._id}`)}
                data-testid={`activity-${a.key}`}
                className="w-full text-start rounded-2xl border border-line bg-surface p-4 hover:border-brand transition flex items-center gap-4 group"
              >
                <span className="w-11 h-11 rounded-xl bg-brand/10 flex items-center justify-center text-xl shrink-0">
                  {a.emoji || '◆'}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-ink">{a.name}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                    {unpublished && (
                      <span className="text-[11px] text-muted">revision {a.currentRevision}</span>
                    )}
                  </span>
                  {a.nameAr && (
                    <span className="block text-[13px] text-muted" dir="rtl">
                      {a.nameAr}
                    </span>
                  )}
                  <span className="block text-[12px] text-muted mt-0.5">
                    {a.draft.fields.length} question{a.draft.fields.length === 1 ? '' : 's'} ·{' '}
                    {a.draft.rules.length} rule{a.draft.rules.length === 1 ? '' : 's'} ·{' '}
                    {a.draft.states.length} step{a.draft.states.length === 1 ? '' : 's'}
                  </span>
                </span>

                <ArrowRight size={16} className="text-muted group-hover:text-brand shrink-0" />
              </button>
            )
          })}
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCreating(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-surface p-5 shadow-pop" data-testid="activity-new-modal">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="font-bold text-ink">New activity</h2>
                <p className="text-[13px] text-muted mt-0.5">
                  Name it now; everything else is built on the next screen.
                </p>
              </div>
              <button onClick={() => setCreating(false)} aria-label="Close" className="text-muted hover:text-ink">
                <X size={18} />
              </button>
            </div>

            <label className="block mb-3">
              <span className="block text-xs font-semibold text-muted mb-1.5">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Desert horse ride"
                data-testid="activity-name"
                className="w-full h-11 px-3 rounded-xl border border-line bg-canvas text-sm text-ink outline-none focus:border-brand"
              />
            </label>

            <label className="block mb-3">
              <span className="block text-xs font-semibold text-muted mb-1.5">Name in Arabic</span>
              <input
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                dir="rtl"
                data-testid="activity-name-ar"
                className="w-full h-11 px-3 rounded-xl border border-line bg-canvas text-sm text-ink outline-none focus:border-brand"
              />
            </label>

            <div className="grid grid-cols-[1fr_88px] gap-3 mb-1">
              <label className="block">
                <span className="block text-xs font-semibold text-muted mb-1.5">Key</span>
                <input
                  value={handle}
                  onChange={(e) => {
                    setKeyTouched(true)
                    setKey(e.target.value)
                  }}
                  data-testid="activity-key"
                  className="w-full h-11 px-3 rounded-xl border border-line bg-canvas text-sm text-ink font-mono outline-none focus:border-brand"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-muted mb-1.5">Icon</span>
                <input
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  placeholder="🐎"
                  data-testid="activity-emoji"
                  className="w-full h-11 px-3 rounded-xl border border-line bg-canvas text-center text-lg outline-none focus:border-brand"
                />
              </label>
            </div>
            <p className="text-[11px] text-muted mb-4">
              The key is how bookings and staff assignments refer to this activity, so it cannot
              be changed later.
            </p>

            {formError && <p className="text-[13px] text-rose-600 mb-3">{formError}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCreating(false)}
                className="h-10 px-4 rounded-xl text-sm font-semibold text-muted hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={create}
                disabled={!valid || busy}
                data-testid="activity-create"
                className="h-10 px-4 rounded-xl bg-brand text-brand-fg text-sm font-semibold disabled:opacity-40"
              >
                {busy ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
