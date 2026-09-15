import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { clsx } from 'clsx'

/**
 * Confirmation that something happened.
 *
 * The control plane's actions are mostly invisible from the screen that starts them —
 * suspending a tenant, retrying provisioning, adding an administrator. Without a word back,
 * the operator's only evidence is that a table redrew, which is indistinguishable from
 * nothing having happened. Every action here says what it did.
 */

interface Toast {
  id: number
  tone: 'good' | 'bad'
  message: string
}

const ToastContext = createContext<{ say: (message: string, tone?: 'good' | 'bad') => void }>({
  say: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastHost({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const say = useCallback((message: string, tone: 'good' | 'bad' = 'good') => {
    const id = Date.now() + Math.random()
    setToasts((all) => [...all, { id, tone, message }])
    window.setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), 5_000)
  }, [])

  const value = useMemo(() => ({ say }), [say])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed bottom-4 end-4 z-50 flex flex-col gap-2 max-w-[min(24rem,calc(100vw-2rem))]"
        role="status"
        aria-live="polite"
        data-testid="platform-toasts"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            data-testid={`platform-toast-${t.tone}`}
            className={clsx(
              'flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] shadow-lg backdrop-blur',
              t.tone === 'good'
                ? 'bg-success/10 border-success/30 text-success'
                : 'bg-danger-strong/10 border-danger-strong/30 text-danger-strong',
            )}
          >
            {t.tone === 'good' ? (
              <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            )}
            <span className="flex-1 min-w-0">{t.message}</span>
            <button
              onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
              aria-label="Dismiss"
              className="shrink-0 opacity-50 hover:opacity-100"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/**
 * A question asked before something that cannot simply be undone.
 *
 * Deliberately not `window.confirm`: the browser's dialog cannot say what the consequence is,
 * and "are you sure?" is not information. This one names the action and spells out what will
 * happen to whom.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  tone = 'primary',
  busy,
  onConfirm,
  onCancel,
  testId,
}: {
  open: boolean
  title: string
  body: React.ReactNode
  confirmLabel: string
  tone?: 'primary' | 'danger'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
  testId?: string
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70" onClick={busy ? undefined : onCancel} />
      <div
        className="relative w-full max-w-md rounded-2xl bg-surface border border-line p-5 shadow-2xl"
        data-testid={testId ?? 'platform-confirm'}
      >
        <h2 className="font-bold text-[15px] mb-2">{title}</h2>
        <div className="text-[13px] text-muted leading-relaxed space-y-2">{body}</div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            disabled={busy}
            data-testid="platform-confirm-cancel"
            className="h-10 px-4 rounded-xl text-[13px] font-semibold text-muted hover:text-ink hover:bg-canvas disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            data-testid="platform-confirm-ok"
            className={clsx(
              'h-10 px-4 rounded-xl text-[13px] font-semibold disabled:opacity-40',
              tone === 'danger'
                ? 'bg-rose-500/20 border border-danger-strong/40 text-danger-strong hover:bg-rose-500/30'
                : 'bg-white text-[#0d1220] hover:bg-white/90',
            )}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
