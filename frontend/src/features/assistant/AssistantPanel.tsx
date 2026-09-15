import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import {
  BookOpen,
  Building2,
  Globe,
  Loader2,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  X,
  Youtube,
} from 'lucide-react'

import { learningApi, type AssistantAnswer } from '@/api/learning.api'
import { ApiError } from '@/api/client'
import { useAssistantUi } from './assistantUi'
import { QUICK_ACTIONS } from './quickActions'

/**
 * The assistant, as an employee uses it.
 *
 * Arabic and right-to-left first: the panel opens on the inside edge, the bubbles are laid
 * out with logical properties (`start`/`end`) so the same markup reads correctly in both
 * directions, and every string comes from the Arabic-first `assistant` namespace.
 *
 * Deliberately a side panel and not a modal — somebody asking "what do I do here?" needs to
 * keep looking at the screen they are asking about.
 */

interface Turn {
  id: string
  role: 'user' | 'assistant'
  content: string
  answer?: AssistantAnswer
  failed?: boolean
}

let turnCounter = 0
const nextId = () => `turn_${(turnCounter += 1)}`

export function AssistantPanel() {
  const { t } = useTranslation(['assistant', 'common'])
  const { open, setOpen, pendingQuestion, clearPending, pageContext, pageVersion } =
    useAssistantUi()

  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const send = useCallback(
    async (question: string) => {
      const text = question.trim()
      if (!text || busy) return

      const userTurn: Turn = { id: nextId(), role: 'user', content: text }
      setTurns((all) => [...all, userTurn])
      setDraft('')
      setBusy(true)

      try {
        const context = pageContext()
        const answer = await learningApi.ask({
          question: text,
          page: context ?? undefined,
          // The last two exchanges only: enough for "and then?" to mean something, not
          // enough to quietly resend a long conversation on every question.
          history: turnsToHistory(turns).slice(-4),
        })
        setTurns((all) => [
          ...all,
          { id: nextId(), role: 'assistant', content: answer.answer, answer },
        ])
      } catch (error) {
        setTurns((all) => [
          ...all,
          {
            id: nextId(),
            role: 'assistant',
            content: error instanceof ApiError ? error.message : t('error.generic'),
            failed: true,
          },
        ])
      } finally {
        setBusy(false)
      }
    },
    [busy, pageContext, t, turns],
  )

  // A quick action opens the panel and asks in one gesture.
  useEffect(() => {
    if (!open || !pendingQuestion) return
    const question = pendingQuestion
    clearPending()
    void send(question)
    // `send` changes identity with every turn; re-running on that would resend the question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendingQuestion])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, busy])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null

  const context = pageContext()

  return createPortal(
    <div className="fixed inset-0 z-[2500]" role="dialog" aria-modal="true" aria-label={t('title')}>
      <div className="absolute inset-0 bg-navy-900/40" onClick={() => setOpen(false)} />

      {/*
        No `dir` on this element. `end-0` resolves against the element's OWN direction, so
        forcing rtl here docked the panel on the left of an English workspace — the opposite
        edge from the button that opens it. Direction belongs to the text inside it, where
        every bubble already carries `dir="auto"` and gets Arabic right on its own.
      */}
      <aside
        data-testid="assistant-panel"
        className="absolute end-0 top-0 bottom-0 w-full sm:max-w-[440px] bg-surface dark:bg-dk-surface border-s border-line dark:border-dk-border flex flex-col shadow-pop animate-[assistantIn_.2s_ease]"
      >
        <header className="flex items-center gap-3 px-4 py-3.5 border-b border-line dark:border-dk-border shrink-0">
          <span className="w-9 h-9 rounded-xl bg-navy-50 dark:bg-dk-elevated text-brand flex items-center justify-center shrink-0">
            <Sparkles size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-navy dark:text-dk-texthi leading-tight">{t('title')}</h2>
            <p className="text-xs text-muted truncate">
              {context?.screenTitle ? t('onScreen', { screen: context.screenTitle }) : t('subtitle')}
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label={t('close', { ns: 'common', defaultValue: 'إغلاق' })}
            className="p-1.5 rounded-lg text-muted hover:bg-black/5 dark:hover:bg-white/5 shrink-0"
            data-testid="assistant-close"
          >
            <X size={18} />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-thin px-4 py-4 space-y-4">
          {turns.length === 0 && <Welcome onPick={send} pageVersion={pageVersion} />}

          {turns.map((turn) =>
            turn.role === 'user' ? (
              <UserBubble key={turn.id} text={turn.content} />
            ) : (
              <AssistantBubble key={turn.id} turn={turn} />
            ),
          )}

          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted" data-testid="assistant-busy">
              <Loader2 size={16} className="animate-spin" />
              {t('thinking')}
            </div>
          )}
        </div>

        <footer className="border-t border-line dark:border-dk-border p-3 shrink-0">
          {turns.length > 0 && <QuickRow onPick={send} compact />}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void send(draft)
            }}
            className="flex items-end gap-2"
          >
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter breaks the line — what a chat box is expected to do.
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send(draft)
                }
              }}
              rows={1}
              dir="auto"
              placeholder={t('placeholder')}
              data-testid="assistant-input"
              className="lf-input flex-1 resize-none max-h-28 py-2.5"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              aria-label={t('send')}
              data-testid="assistant-send"
              className="lf-btn-primary h-11 w-11 p-0 shrink-0 disabled:opacity-40"
            >
              <Send size={17} className="rtl:-scale-x-100" />
            </button>
          </form>
          <p className="text-[11px] text-muted mt-2 text-center">{t('disclaimer')}</p>
        </footer>
      </aside>

      <style>{`@keyframes assistantIn{from{transform:translateX(-24px);opacity:.4}to{transform:none;opacity:1}}`}</style>
    </div>,
    document.body,
  )
}

function turnsToHistory(turns: Turn[]): { role: 'user' | 'assistant'; content: string }[] {
  return turns.filter((x) => !x.failed).map((x) => ({ role: x.role, content: x.content }))
}

function Welcome({ onPick, pageVersion }: { onPick: (q: string) => void; pageVersion: number }) {
  const { t } = useTranslation('assistant')
  return (
    <div className="text-center py-6" key={pageVersion}>
      <div className="w-14 h-14 rounded-2xl bg-navy-50 dark:bg-dk-elevated text-brand flex items-center justify-center mx-auto mb-3">
        <Sparkles size={24} />
      </div>
      <h3 className="font-semibold text-navy dark:text-dk-texthi">{t('welcome.title')}</h3>
      <p className="text-sm text-muted mt-1 mb-5 px-4">{t('welcome.body')}</p>
      <QuickRow onPick={onPick} />
    </div>
  )
}

function QuickRow({ onPick, compact }: { onPick: (q: string) => void; compact?: boolean }) {
  const { t } = useTranslation('assistant')
  return (
    <div
      className={clsx('flex flex-wrap gap-2 justify-center', compact ? 'mb-2.5' : 'px-2')}
      data-testid="assistant-quick-actions"
    >
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={() => onPick(t(action.questionKey))}
          data-testid={`assistant-quick-${action.id}`}
          className="lf-chip bg-navy-50 dark:bg-dk-elevated text-brand dark:text-accent hover:opacity-80 transition-opacity"
        >
          {t(action.labelKey)}
        </button>
      ))}
    </div>
  )
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p
        dir="auto"
        className="max-w-[85%] rounded-2xl rounded-ee-md bg-brand text-brand-fg px-3.5 py-2.5 text-sm whitespace-pre-wrap"
      >
        {text}
      </p>
    </div>
  )
}

function AssistantBubble({ turn }: { turn: Turn }) {
  const { t } = useTranslation('assistant')
  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] w-full space-y-2.5">
        <div
          dir="auto"
          data-testid="assistant-answer"
          className={clsx(
            'rounded-2xl rounded-es-md px-3.5 py-3 text-sm whitespace-pre-wrap leading-relaxed',
            turn.failed
              ? 'bg-red-50 dark:bg-red-900/20 text-danger-strong'
              : 'bg-canvas dark:bg-dk-elevated text-navy dark:text-dk-text',
          )}
        >
          {turn.content}
        </div>

        {turn.answer && !turn.failed && (
          <>
            <Sources answer={turn.answer} />
            <Videos answer={turn.answer} />
            <div className="flex items-center gap-1.5 flex-wrap">
              <SpeakButton text={turn.answer.answer} interactionId={turn.answer.interaction_id} />
              <FeedbackButtons interactionId={turn.answer.interaction_id} />
            </div>
            {!turn.answer.grounded && (
              <p className="text-[11px] text-muted">{t('notGrounded')}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Sources({ answer }: { answer: AssistantAnswer }) {
  const { t } = useTranslation('assistant')
  const [expanded, setExpanded] = useState<string | null>(null)
  if (answer.sources.length === 0) return null

  return (
    <div className="space-y-1.5" data-testid="assistant-sources">
      <p className="lf-label mb-0">{t('sources')}</p>
      {answer.sources.map((source) => (
        <button
          key={source.document_id}
          type="button"
          onClick={() =>
            setExpanded((current) => (current === source.document_id ? null : source.document_id))
          }
          className="w-full text-start lf-card p-2.5 hover:shadow-cardhover transition-shadow"
        >
          <span className="flex items-center gap-2">
            <BookOpen size={14} className="text-brand shrink-0" />
            <span className="flex-1 min-w-0 text-[13px] font-semibold text-navy dark:text-dk-texthi truncate">
              {source.title}
            </span>
            {/*
              Whose rule this is matters operationally: "the company says" and "the system
              says" are different kinds of authority when they disagree.
            */}
            <span
              className={clsx(
                'lf-chip shrink-0 gap-1',
                source.scope === 'TENANT'
                  ? 'bg-emerald-50 text-success dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'bg-blue-50 text-brand dark:bg-dk-elevated dark:text-accent',
              )}
            >
              {source.scope === 'TENANT' ? <Building2 size={11} /> : <Globe size={11} />}
              {source.scope === 'TENANT'
                ? (source.tenant_name ?? t('scope.tenant'))
                : t('scope.global')}
            </span>
          </span>
          {expanded === source.document_id && source.relevant_excerpt && (
            <span
              dir="auto"
              className="block mt-2 pt-2 border-t border-line dark:border-dk-border text-xs text-muted leading-relaxed"
            >
              {source.relevant_excerpt}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

function Videos({ answer }: { answer: AssistantAnswer }) {
  const { t } = useTranslation('assistant')
  if (answer.videos.length === 0) return null

  return (
    <div className="space-y-1.5" data-testid="assistant-videos">
      {answer.videos.map((video) => (
        <a
          key={video.url}
          href={video.url}
          target="_blank"
          /*
           * `noopener` is the security half — a new tab must not get a handle on this window.
           * The link is never fetched by any server here; the browser is the only thing that
           * ever contacts YouTube.
           */
          rel="noopener noreferrer"
          onClick={() => {
            void learningApi
              .videoClick({
                url: video.url,
                title: video.title,
                interactionId: answer.interaction_id,
                documentId: video.document_id,
              })
              .catch(() => {
                /* analytics must never get in the way of opening the video */
              })
          }}
          data-testid="assistant-video-link"
          className="lf-card p-2.5 flex items-center gap-2 hover:shadow-cardhover transition-shadow"
        >
          <Youtube size={16} className="text-danger-strong shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-semibold text-navy dark:text-dk-texthi truncate">
              {t('watchVideo')}
            </span>
            <span className="block text-xs text-muted truncate">{video.title}</span>
          </span>
        </a>
      ))}
    </div>
  )
}

function SpeakButton({ text, interactionId }: { text: string; interactionId: string }) {
  const { t } = useTranslation('assistant')
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'failed'>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)

  // The object URL is revoked when the bubble goes away, so a long conversation does not
  // accumulate blobs the browser is holding on our behalf.
  useEffect(
    () => () => {
      audioRef.current?.pause()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )

  const speak = async () => {
    if (state === 'playing') {
      audioRef.current?.pause()
      setState('idle')
      return
    }
    setState('loading')
    try {
      if (!urlRef.current) {
        const blob = await learningApi.speak(text, interactionId)
        urlRef.current = URL.createObjectURL(blob)
      }
      const audio = audioRef.current ?? new Audio()
      audioRef.current = audio
      audio.src = urlRef.current
      audio.onended = () => setState('idle')
      await audio.play()
      setState('playing')
    } catch {
      setState('failed')
    }
  }

  return (
    <button
      type="button"
      onClick={() => void speak()}
      disabled={state === 'loading'}
      data-testid="assistant-speak"
      className="lf-chip bg-navy-50 dark:bg-dk-elevated text-brand dark:text-accent gap-1.5 disabled:opacity-50"
    >
      {state === 'loading' ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        <Volume2 size={12} />
      )}
      {state === 'failed' ? t('speech.unavailable') : state === 'playing' ? t('speech.stop') : t('speech.listen')}
    </button>
  )
}

function FeedbackButtons({ interactionId }: { interactionId: string }) {
  const { t } = useTranslation('assistant')
  const [sent, setSent] = useState<boolean | null>(null)

  const send = (helpful: boolean) => {
    setSent(helpful)
    void learningApi.feedback({ interactionId, helpful }).catch(() => setSent(null))
  }

  if (sent !== null) {
    return <span className="lf-chip bg-emerald-50 text-success dark:bg-emerald-900/30 dark:text-emerald-300">{t('feedback.thanks')}</span>
  }

  return (
    <>
      <button
        type="button"
        onClick={() => send(true)}
        data-testid="assistant-helpful"
        className="lf-chip bg-slate-100 dark:bg-dk-elevated text-muted hover:text-success gap-1.5"
      >
        <ThumbsUp size={12} /> {t('feedback.helpful')}
      </button>
      <button
        type="button"
        onClick={() => send(false)}
        data-testid="assistant-not-helpful"
        className="lf-chip bg-slate-100 dark:bg-dk-elevated text-muted hover:text-danger-strong gap-1.5"
      >
        <ThumbsDown size={12} /> {t('feedback.notHelpful')}
      </button>
    </>
  )
}
