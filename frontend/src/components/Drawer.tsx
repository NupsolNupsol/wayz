import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  testId,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
  testId?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[2000]" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-navy-900/50" onClick={onClose} />
      <div
        data-testid={testId}
        className="absolute end-0 top-0 bottom-0 w-full max-w-md bg-surface shadow-pop border-s border-line flex flex-col animate-[drawerIn_.2s_ease]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h3 className="font-bold text-navy dark:text-dk-texthi">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-muted hover:bg-black/5">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto scroll-thin flex-1">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-line flex items-center justify-end gap-2">{footer}</div>}
      </div>
      <style>{`@keyframes drawerIn{from{transform:translateX(24px);opacity:.5}to{transform:none;opacity:1}}`}</style>
    </div>,
    document.body,
  )
}
