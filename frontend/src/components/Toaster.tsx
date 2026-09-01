import { createPortal } from 'react-dom'
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react'
import { useToastStore, type ToastLevel } from '@/state/toastStore'

const ICON: Record<ToastLevel, React.ReactNode> = {
  info: <Info size={18} className="text-brand" />,
  success: <CheckCircle2 size={18} className="text-success" />,
  warning: <AlertTriangle size={18} className="text-amber-500" />,
  danger: <XCircle size={18} className="text-danger-strong" />,
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  return createPortal(
    <div className="fixed bottom-5 end-5 z-[3000] flex flex-col gap-2 w-[340px] max-w-[calc(100vw-2rem)]" data-testid="toaster">
      {toasts.map((t) => (
        <div key={t.id} role="status" className="lf-card p-3.5 flex items-start gap-3 shadow-pop animate-[toastIn_.18s_ease]">
          <div className="mt-0.5">{ICON[t.level]}</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-navy dark:text-dk-texthi">{t.title}</p>
            {t.message && <p className="text-xs text-muted mt-0.5">{t.message}</p>}
          </div>
          <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-muted hover:text-navy p-0.5">
            <X size={14} />
          </button>
        </div>
      ))}
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}`}</style>
    </div>,
    document.body,
  )
}
