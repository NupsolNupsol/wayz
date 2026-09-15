import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import {
  BookOpenCheck,
  CircleHelp,
  MessageSquareText,
  ThumbsUp,
  TriangleAlert,
  Volume2,
  Youtube,
} from 'lucide-react'

import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pill,
  PlatformCard,
  SectionHeading,
  Skeleton,
  StatCard,
  when,
} from '../components'
import { knowledgeApi } from '../knowledgeApi'
import { ApiError } from '@/api/client'

/**
 * What employees actually ask, and what the documentation fails to answer.
 *
 * The useful half of this screen is the unanswered list. "Most asked question" is
 * interesting; "twenty people asked this and we had nothing to tell them" is a work item —
 * it names the document somebody needs to write.
 *
 * Deliberately built on counted events rather than stored transcripts: the question text and
 * the page are kept, the answer is not, and no customer record ever enters this table.
 */

const RANGES = [7, 30, 90] as const

export function PlatformLearningPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30)
  const [tenantId, setTenantId] = useState('')

  const vocabulary = useQuery({ queryKey: ['knowledge', 'vocabulary'], queryFn: knowledgeApi.vocabulary })
  const report = useQuery({
    queryKey: ['knowledge', 'analytics', days, tenantId],
    queryFn: () => knowledgeApi.analytics({ days, tenantId }),
    enabled: vocabulary.data?.enabled !== false,
  })

  if (vocabulary.data && !vocabulary.data.enabled) {
    return (
      <>
        <PageHeader title="Learning analytics" blurb="How the employee assistant is being used." />
        <EmptyState
          icon={BookOpenCheck}
          title="The learning AI service is not configured"
          blurb="Set AI_SERVICE_SECRET and AI_SERVICE_URL in backend/.env, then start the learning-ai service."
          testId="analytics-disabled"
        />
      </>
    )
  }

  const totals = report.data?.totals
  const answered = totals ? totals.questions - totals.ungrounded : 0
  const coverage = totals && totals.questions > 0 ? Math.round((answered / totals.questions) * 100) : null

  return (
    <>
      <PageHeader
        title="Learning analytics"
        blurb="What employees ask the assistant, which documents answer them, and which questions the knowledge base cannot answer yet."
        testId="analytics-header"
        actions={
          <div className="flex items-center gap-2">
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              data-testid="analytics-tenant"
              className="h-10 px-3 rounded-xl bg-canvas border border-line text-[13px] text-white outline-none"
            >
              <option value="">All companies</option>
              {(vocabulary.data?.tenants ?? []).map((tenant) => (
                <option key={tenant.id} value={tenant.id} className="bg-surface">
                  {tenant.name}
                </option>
              ))}
            </select>
            <div className="flex rounded-xl bg-canvas border border-line p-0.5">
              {RANGES.map((range) => (
                <button
                  key={range}
                  onClick={() => setDays(range)}
                  data-testid={`analytics-range-${range}`}
                  className={clsx(
                    'px-3 h-9 rounded-lg text-[12px] font-semibold transition-colors',
                    days === range ? 'bg-brand text-brand-fg' : 'text-muted hover:text-ink',
                  )}
                >
                  {range}d
                </button>
              ))}
            </div>
          </div>
        }
      />

      {report.isLoading ? (
        <Skeleton rows={5} />
      ) : report.isError ? (
        <ErrorState
          message={report.error instanceof ApiError ? report.error.message : 'Could not load analytics.'}
          onRetry={() => void report.refetch()}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-5">
            <StatCard
              label="Questions asked"
              value={totals?.questions ?? 0}
              icon={MessageSquareText}
              testId="analytics-questions"
            />
            <StatCard
              label="Answered from documentation"
              value={coverage}
              unit="%"
              hint={`${answered} of ${totals?.questions ?? 0}`}
              unavailable={coverage === null ? 'No questions in this period' : undefined}
              tone={coverage !== null && coverage < 60 ? 'warn' : 'quiet'}
              icon={BookOpenCheck}
              testId="analytics-coverage"
            />
            <StatCard
              label="Marked helpful"
              value={totals?.helpful ?? 0}
              hint={`${totals?.not_helpful ?? 0} marked not helpful`}
              icon={ThumbsUp}
              testId="analytics-helpful"
            />
            <StatCard
              label="Listened / videos opened"
              value={`${totals?.speech_requests ?? 0} / ${totals?.video_clicks ?? 0}`}
              icon={Volume2}
              testId="analytics-engagement"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2 items-start">
            <PlatformCard testId="analytics-unanswered">
              <SectionHeading
                title="Unanswered questions"
                blurb="Nothing in the knowledge base covered these. Each one is a document worth writing."
              />
              {(report.data?.unanswered.length ?? 0) === 0 ? (
                <EmptyState
                  icon={TriangleAlert}
                  title="Nothing unanswered"
                  blurb="Every question in this period found supporting documentation."
                />
              ) : (
                <ul className="space-y-2" >
                  {report.data!.unanswered.map((row, index) => (
                    <li
                      key={`${row.question}-${index}`}
                      className="rounded-xl bg-canvas border border-line p-3"
                    >
                      <p dir="auto" className="text-[13px] text-ink">
                        {row.question}
                      </p>
                      <p className="text-[11px] text-muted mt-1 flex flex-wrap gap-2">
                        {row.tenant_name && <span>{row.tenant_name}</span>}
                        {row.role && <span>· {row.role}</span>}
                        {row.page_key && <span>· {row.page_key}</span>}
                        <span>· {when(row.at)}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </PlatformCard>

            <div className="space-y-5">
              <PlatformCard testId="analytics-questions-list">
                <SectionHeading title="Most asked" />
                <RankedList
                  rows={(report.data?.top_questions ?? []).map((r) => ({
                    label: r.question,
                    value: r.count,
                  }))}
                  empty="No questions yet."
                />
              </PlatformCard>

              <PlatformCard testId="analytics-pages">
                <SectionHeading
                  title="Where help is asked for"
                  blurb="The screens people are standing on when they ask."
                />
                <RankedList
                  rows={(report.data?.top_pages ?? []).map((r) => ({
                    label: r.page_key || 'unknown',
                    value: r.count,
                  }))}
                  empty="No page context recorded yet."
                />
              </PlatformCard>

              <PlatformCard testId="analytics-documents">
                <SectionHeading title="Most used documents" />
                {/*
                  A ranked list, not a table. `DataTable` carries a 620px minimum so its
                  columns stay readable, which is right on a full-width page and wrong in a
                  half-width card — the citation count fell off the edge into a scroll
                  nobody would think to look for.
                */}
                <RankedList
                  rows={(report.data?.top_documents ?? []).map((r) => ({
                    label: r.title || r.document_id,
                    value: r.uses,
                  }))}
                  empty="No document has been cited yet."
                />
              </PlatformCard>

              <PlatformCard testId="analytics-videos">
                <SectionHeading title="Training videos opened" />
                {(report.data?.top_videos.length ?? 0) === 0 ? (
                  <p className="text-[13px] text-muted">No training video has been opened yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {report.data!.top_videos.map((video) => (
                      <li key={video.url} className="flex items-center gap-2 text-[13px]">
                        <Youtube size={14} className="text-danger-strong shrink-0" />
                        <a
                          href={video.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 min-w-0 truncate text-ink hover:text-ink"
                          dir="auto"
                        >
                          {video.title || video.url}
                        </a>
                        <Pill>{video.clicks}</Pill>
                      </li>
                    ))}
                  </ul>
                )}
              </PlatformCard>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function RankedList({
  rows,
  empty,
}: {
  rows: { label: string; value: number }[]
  empty: string
}) {
  if (rows.length === 0) return <p className="text-[13px] text-muted">{empty}</p>
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul className="space-y-1.5">
      {rows.map((row, index) => (
        <li key={`${row.label}-${index}`} className="flex items-center gap-2.5">
          <span className="flex-1 min-w-0">
            <span dir="auto" className="block text-[13px] text-ink truncate">
              {row.label}
            </span>
            {/* A bar rather than a chart: this is a ranked list, and a ranked list reads
                faster with a length than with a number alone. */}
            <span className="block h-1 rounded-full bg-canvas mt-1 overflow-hidden">
              <span
                className="block h-full bg-sky-400/60"
                style={{ width: `${Math.max((row.value / max) * 100, 4)}%` }}
              />
            </span>
          </span>
          <span className="text-[12px] font-semibold text-muted shrink-0 tabular-nums">
            {row.value}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Kept for the empty state above the fold when nothing has been asked at all. */
export const LEARNING_EMPTY_ICON = CircleHelp
