import { useState } from 'react'
import { CircleCheck, MessageSquareWarning, Send, TriangleAlert, X } from 'lucide-react'
import { clsx } from 'clsx'
import { useCheckChange, useReportIssue } from '@/hooks'
import { toast } from '@/state/toastStore'
import { ApiError } from '@/api/client'
import type { VersionChange } from '@/api/versions.api'

const NAME_KEY = 'wayz.versions.tester'

const readName = () => {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

const rememberName = (name: string) => {
  try {
    window.localStorage.setItem(NAME_KEY, name)
  } catch {
    /* a private window is fine — they just type it again */
  }
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function ChangeVerdict({
  versionId,
  index,
  change,
}: {
  versionId: string
  index: number
  change: VersionChange
}) {
  const check = useCheckChange(versionId)
  const report = useReportIssue(versionId)

  const [name, setName] = useState(readName)
  const [asking, setAsking] = useState<'CHECK' | 'ISSUE' | null>(null)
  const [note, setNote] = useState('')

  const checks = change.checks ?? []
  const issues = change.issues ?? []
  const openIssues = issues.filter((i) => i.status === 'OPEN')
  const mine = checks.some((c) => c.by.toLowerCase() === name.trim().toLowerCase() && name.trim().length > 0)

  const fail = (e: unknown) =>
    toast('danger', 'That did not go through', e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : '')

  const confirmCheck = () => {
    const who = name.trim()
    if (!who) return
    rememberName(who)
    check.mutate(
      { index, by: who },
      {
        onSuccess: () => {
          setAsking(null)
          toast('success', 'Marked as checked', `${change.title} — thanks, ${who}.`)
        },
        onError: fail,
      },
    )
  }

  const confirmIssue = () => {
    const who = name.trim()
    if (!who || note.trim().length < 3) return
    rememberName(who)
    report.mutate(
      { index, by: who, note: note.trim() },
      {
        onSuccess: () => {
          setAsking(null)
          setNote('')
          toast('warning', 'Reported', 'The team can see it on this release.')
        },
        onError: fail,
      },
    )
  }

  return (
    <div className="mt-4 pt-4 border-t border-line dark:border-dk-border" data-testid={`version-verdict-${index}`}>
      <div className="flex flex-wrap items-center gap-2">
        {checks.length > 0 ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/25 text-success text-xs font-semibold px-3 py-1.5"
            data-testid={`version-checked-${index}`}
          >
            <CircleCheck size={13} />
            Checked by {checks.map((c) => c.by).join(', ')}
          </span>
        ) : (
          <span className="text-xs text-muted" data-testid={`version-unchecked-${index}`}>
            Nobody has checked this yet
          </span>
        )}

        {openIssues.length > 0 && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-900/25 text-amber-700 dark:text-amber-300 text-xs font-semibold px-3 py-1.5"
            data-testid={`version-issue-count-${index}`}
          >
            <TriangleAlert size={13} /> {openIssues.length} open report{openIssues.length === 1 ? '' : 's'}
          </span>
        )}

        <span className="flex-1" />

        <button
          type="button"
          onClick={() => setAsking(asking === 'CHECK' ? null : 'CHECK')}
          disabled={check.isPending}
          className={clsx(
            'lf-btn !h-9 !px-3 text-xs border',
            mine
              ? 'border-success/50 text-success bg-emerald-50 dark:bg-emerald-900/25'
              : 'border-line dark:border-dk-border text-muted hover:text-success hover:border-success/50',
          )}
          data-testid={`version-check-${index}`}
        >
          <CircleCheck size={14} /> {mine ? 'You checked this' : 'Mark as checked'}
        </button>

        <button
          type="button"
          onClick={() => setAsking(asking === 'ISSUE' ? null : 'ISSUE')}
          className="lf-btn !h-9 !px-3 text-xs border border-line dark:border-dk-border text-muted hover:text-danger-strong hover:border-danger-strong/50"
          data-testid={`version-report-${index}`}
        >
          <MessageSquareWarning size={14} /> Report an issue
        </button>
      </div>

      {asking && (
        <div className="mt-3 rounded-xl2 border border-line dark:border-dk-border bg-canvas dark:bg-dk-elevated p-3" data-testid={`version-form-${index}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-navy dark:text-dk-texthi">
              {asking === 'CHECK' ? 'Who checked it?' : 'What went wrong?'}
            </p>
            <button type="button" onClick={() => setAsking(null)} className="text-muted hover:text-navy" aria-label="Close">
              <X size={14} />
            </button>
          </div>

          <input
            className="lf-input mb-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            data-testid={`version-name-${index}`}
          />

          {asking === 'ISSUE' && (
            <textarea
              className="lf-input min-h-[80px] mb-2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What did you do, and what happened instead?"
              data-testid={`version-note-${index}`}
            />
          )}

          <button
            type="button"
            className="lf-btn-primary !h-9 text-xs"
            disabled={!name.trim() || (asking === 'ISSUE' && note.trim().length < 3) || check.isPending || report.isPending}
            onClick={() => (asking === 'CHECK' ? confirmCheck() : confirmIssue())}
            data-testid={`version-submit-${index}`}
          >
            <Send size={13} /> {asking === 'CHECK' ? 'It works' : 'Send the report'}
          </button>
        </div>
      )}

      {issues.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2" data-testid={`version-issues-${index}`}>
          {issues.map((issue, n) => (
            <li
              key={`${issue.by}-${issue.at}-${n}`}
              className={clsx(
                'rounded-xl2 border p-3',
                issue.status === 'OPEN'
                  ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-500/40'
                  : 'border-line dark:border-dk-border opacity-70',
              )}
              data-testid={`version-issue-${index}-${n}`}
            >
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <TriangleAlert size={13} className="text-amber-600 dark:text-amber-300 shrink-0" />
                <span className="text-xs font-bold text-navy dark:text-dk-texthi">{issue.by}</span>
                <span className="text-[11px] text-muted">{when(issue.at)}</span>
                {issue.status === 'RESOLVED' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-success">fixed</span>
                )}
              </div>
              <p className="text-sm text-navy dark:text-dk-text leading-relaxed whitespace-pre-wrap">{issue.note}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
