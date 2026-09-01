import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, Search } from 'lucide-react'
import { clsx } from 'clsx'
import type { ReactNode } from 'react'

export interface SelectOption {
  label: string
  value: string
  icon?: ReactNode
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  testId,
  searchable = false,
  size = 'md',
  className,
  align = 'left',
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  testId?: string
  searchable?: boolean
  size?: 'sm' | 'md'
  className?: string
  align?: 'left' | 'right'
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [])

  // The menu is portalled to the body so a scrolling parent — a modal, a card — cannot
  // clip it or gain a scrollbar because of it. That means measuring the trigger instead
  // of relying on absolute positioning.
  // The menu is measured, never guessed: a guessed height flips it by the wrong amount and
  // leaves it floating above the field. It is rendered hidden until the real height is known.
  const place = useCallback(() => {
    const el = ref.current
    const menu = menuRef.current
    if (!el || !menu) return
    const rect = el.getBoundingClientRect()
    const width = Math.max(rect.width, 200)
    const menuHeight = menu.offsetHeight
    const below = window.innerHeight - rect.bottom
    const flip = below < menuHeight + 12 && rect.top > menuHeight + 12
    const wanted = flip ? rect.top - menuHeight - 6 : rect.bottom + 6
    const top = Math.max(8, Math.min(wanted, window.innerHeight - menuHeight - 8))
    const left = align === 'right' ? Math.max(8, rect.right - width) : Math.min(rect.left, window.innerWidth - width - 8)
    setAnchor((prev) =>
      prev && prev.top === top && prev.left === left && prev.width === width ? prev : { top, left, width },
    )
  }, [align])

  useLayoutEffect(() => {
    if (!open) {
      setAnchor(null)
      return
    }
    place()
    // Searching filters the list, so the menu changes height while it is open.
    const observer = new ResizeObserver(place)
    if (menuRef.current) observer.observe(menuRef.current)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, place, q])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? options.filter((o) => o.label.toLowerCase().includes(s)) : options
  }, [q, options])

  return (
    <div ref={ref} className={clsx('relative', className)} data-testid={testId}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        data-testid={testId ? `${testId}-button` : undefined}
        className={clsx(
          'w-full rounded-xl2 border-[1.5px] border-line bg-canvas dark:bg-dk-elevated text-navy dark:text-dk-text',
          'flex items-center justify-between gap-2 outline-none transition-colors',
          disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-brand/60 focus:border-brand focus:ring-[3px] focus:ring-brand/15',
          size === 'sm' ? 'h-9 px-3 text-sm' : 'h-11 px-3.5 text-sm',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={clsx('flex items-center gap-2 truncate', !selected && 'text-muted')}>
          {selected?.icon}
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className={clsx('text-muted transition-transform shrink-0', open && 'rotate-180')} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[10000] lf-card p-1 shadow-pop"
            style={{
              top: anchor?.top ?? 0,
              left: anchor?.left ?? 0,
              width: anchor?.width,
              visibility: anchor ? 'visible' : 'hidden',
            }}
            role="listbox"
            data-testid={testId ? `${testId}-menu` : undefined}
          >
          {searchable && (
            <div className="p-1.5 border-b border-line mb-1">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-full h-8 pl-8 pr-2 rounded-lg bg-canvas dark:bg-dk-elevated border border-line text-sm outline-none focus:border-brand" />
              </div>
            </div>
          )}
          <div className="max-h-60 overflow-y-auto scroll-thin">
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => { onChange(o.value); setOpen(false); setQ('') }}
                data-testid={testId ? `${testId}-opt-${o.value}` : undefined}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors',
                  o.value === value ? 'bg-brand/10 text-brand font-semibold' : 'text-navy dark:text-dk-text hover:bg-brand/5',
                )}
              >
                {o.icon}
                <span className="truncate">{o.label}</span>
                {o.value === value && <Check size={15} className="ml-auto text-brand" />}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-2 text-sm text-muted">No match</p>}
          </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
