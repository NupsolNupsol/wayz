import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { clsx } from 'clsx'
import type { ReactNode } from 'react'

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  testId,
}: {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  testId?: string
}) {
  const { t } = useTranslation('ui')
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const width = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size]

  return createPortal(
    <div
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-navy-900/50 backdrop-blur-[1px]" onClick={onClose} />
      <div
        data-testid={testId}
        className={clsx(
          'relative w-full bg-surface rounded-t-2xl sm:rounded-2xl shadow-pop border border-line',
          'max-h-[92vh] flex flex-col animate-[modalIn_.18s_ease]',
          width,
        )}
      >
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-line">
            <div>
              {title && <h3 className="font-bold text-navy dark:text-dk-texthi">{title}</h3>}
              {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
            </div>
            <button onClick={onClose} aria-label={t('modal.close')} className="p-1.5 rounded-lg text-muted hover:bg-black/5 shrink-0" data-testid="modal-close">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="px-5 py-4 overflow-y-auto scroll-thin">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-line flex items-center justify-end gap-2">{footer}</div>}
      </div>
      <style>{`@keyframes modalIn{from{opacity:.4;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
    </div>,
    document.body,
  )
}
