import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Filter, Inbox, X } from 'lucide-react'
import { EmptyState } from './ui'
import type { SelectOption } from './Select'

export type ColumnFilter<T> =
  | { kind: 'text'; value: (row: T) => string }
  | { kind: 'select'; options: SelectOption[]; value: (row: T) => string }

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  sortValue?: (row: T) => string | number
  filter?: ColumnFilter<T>
  align?: 'left' | 'right' | 'center'
  className?: string
}

type SortState = { key: string; dir: 'asc' | 'desc' } | null
type OpenFilter = string | null

export function DataTable<T>({
  columns,
  rows,
  keyOf,
  onRowClick,
  empty,
  testId,
  initialSort,
  pageSize = 10,
  className,
  footer,
}: {
  columns: Column<T>[]
  rows: T[]
  keyOf: (row: T) => string
  onRowClick?: (row: T) => void
  empty?: { title: string; message?: string }
  testId?: string
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  pageSize?: number
  className?: string
  /** A totals line, one cell per column, pinned under the rows. */
  footer?: (rows: T[]) => ReactNode[]
}) {
  const { t } = useTranslation('ui')
  const [sort, setSort] = useState<SortState>(initialSort ?? null)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<OpenFilter>(null)
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null)
  const [page, setPage] = useState(0)
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({})
  const popover = useRef<HTMLDivElement>(null)

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null))
  const setFilter = (key: string, val: string) =>
    setFilters((f) => {
      const next = { ...f }
      if (!val) delete next[key]
      else next[key] = val
      return next
    })

  const visible = useMemo(() => {
    let out = rows
    for (const col of columns) {
      const active = filters[col.key]
      if (!active || !col.filter) continue
      const val = col.filter.value
      out = col.filter.kind === 'text' ? out.filter((r) => val(r).toLowerCase().includes(active.toLowerCase())) : out.filter((r) => val(r) === active)
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key)
      if (col?.sortValue) {
        const acc = col.sortValue
        out = [...out].sort((a, b) => {
          const av = acc(a)
          const bv = acc(b)
          const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
          return sort.dir === 'asc' ? cmp : -cmp
        })
      }
    }
    return out
  }, [rows, columns, filters, sort])

  useEffect(() => setPage(0), [filters, sort, rows.length])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const placePopover = useCallback(() => {
    const button = open ? buttons.current[open] : null
    if (!button) return
    const rect = button.getBoundingClientRect()
    const height = popover.current?.offsetHeight ?? 260
    const below = window.innerHeight - rect.bottom
    const top =
      below < height + 12 && rect.top > height + 12
        ? Math.max(8, rect.top - height - 6)
        : Math.min(rect.bottom + 6, window.innerHeight - height - 8)
    setAnchor({ top: Math.max(8, top), left: Math.max(8, Math.min(rect.left, window.innerWidth - 236)) })
  }, [open])

  // Filtering can empty the table and move the header, so the anchor is re-measured
  // rather than captured once when the button was clicked.
  useLayoutEffect(() => {
    if (!open) {
      setAnchor(null)
      return
    }
    placePopover()
    window.addEventListener('scroll', placePopover, true)
    window.addEventListener('resize', placePopover)
    return () => {
      window.removeEventListener('scroll', placePopover, true)
      window.removeEventListener('resize', placePopover)
    }
  }, [open, placePopover, filters, sort, rows.length, page])
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize))
  const current = Math.min(page, pageCount - 1)
  const paged = visible.slice(current * pageSize, current * pageSize + pageSize)
  const from = visible.length === 0 ? 0 : current * pageSize + 1
  const to = Math.min(visible.length, current * pageSize + pageSize)

  const alignCls = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left')
  const openCol = open ? columns.find((c) => c.key === open) : null

  if (rows.length === 0) {
    return <EmptyState icon={<Inbox size={22} />} title={empty?.title ?? 'Nothing here yet'} message={empty?.message} />
  }

  return (
    <div data-testid={testId} className={clsx('bg-surface dark:bg-dk-surface rounded-card border border-line shadow-card overflow-hidden', className)}>
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-brand/[0.09] dark:bg-brand/[0.16] border-b-2 border-brand/25">
              {columns.map((c) => {
                const sorted = sort?.key === c.key
                const isFiltered = !!filters[c.key]
                return (
                  <th key={c.key} className={clsx('px-4 py-3 font-bold text-[11.5px] uppercase tracking-wide text-navy dark:text-dk-texthi whitespace-nowrap', alignCls(c.align))}>
                    <div className={clsx('flex items-center gap-1.5', c.align === 'right' && 'justify-end', c.align === 'center' && 'justify-center')}>
                      {c.sortValue ? (
                        <button onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-brand transition-colors" data-testid={testId ? `sort-${c.key}` : undefined}>
                          {c.header}
                          {sorted ? (sort!.dir === 'asc' ? <ArrowUp size={13} className="text-brand" /> : <ArrowDown size={13} className="text-brand" />) : <ArrowUpDown size={13} className="text-muted/60" />}
                        </button>
                      ) : (
                        <span>{c.header}</span>
                      )}
                      {c.filter && (
                        <button
                          ref={(el) => {
                            buttons.current[c.key] = el
                          }}
                          onClick={() => setOpen((o) => (o === c.key ? null : c.key))}
                          data-testid={testId ? `filter-${c.key}` : undefined}
                          className={clsx('p-0.5 rounded transition-colors', isFiltered ? 'text-brand' : 'text-muted/50 hover:text-brand')}
                          aria-label={`Filter ${c.header}`}
                        >
                          <Filter size={13} />
                        </button>
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr
                key={keyOf(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                data-testid={`row-${keyOf(row)}`}
                className={clsx('border-t border-line transition-colors', i % 2 === 1 && 'bg-canvas/40 dark:bg-dk-elevated/30', onRowClick && 'cursor-pointer hover:bg-brand/5')}
              >
                {columns.map((c) => (
                  <td key={c.key} className={clsx('px-4 py-3 align-middle', alignCls(c.align), c.className)}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && visible.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-brand/25 bg-canvas/60 dark:bg-dk-elevated/40 font-bold" data-testid={testId ? `${testId}-totals` : undefined}>
                {footer(visible).map((cell, i) => (
                  <td key={columns[i]?.key ?? i} className={clsx('px-4 py-3 align-middle', alignCls(columns[i]?.align), columns[i]?.className)}>
                    {cell}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {visible.length === 0 && (
        <div className="p-6 text-center text-sm text-muted">{t('table.noRows')}<button className="text-brand font-medium" onClick={() => setFilters({})}>{t('table.clearFilters')}</button>
        </div>
      )}

      {visible.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-line bg-canvas/40 dark:bg-dk-elevated/30" data-testid={testId ? `${testId}-pagination` : undefined}>
          <p className="text-xs text-muted">{t('table.showing')}<strong className="text-navy dark:text-dk-text">{from}</strong>–<strong className="text-navy dark:text-dk-text">{to}</strong> {t('table.of')} <strong className="text-navy dark:text-dk-text">{visible.length}</strong>
          </p>
          {pageCount > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={current === 0} data-testid={testId ? `${testId}-prev` : undefined}
                className="w-8 h-8 rounded-lg border border-line flex items-center justify-center text-muted hover:text-brand hover:border-brand disabled:opacity-40 disabled:hover:text-muted disabled:hover:border-line"><ChevronLeft size={16} /></button>
              {Array.from({ length: pageCount }).slice(Math.max(0, current - 2), Math.max(0, current - 2) + 5).map((_, idx) => {
                const p = Math.max(0, current - 2) + idx
                return (
                  <button key={p} onClick={() => setPage(p)} className={clsx('min-w-8 h-8 px-2 rounded-lg text-sm font-semibold', p === current ? 'bg-brand text-brand-fg' : 'border border-line text-muted hover:text-brand hover:border-brand')}>{p + 1}</button>
                )
              })}
              <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={current >= pageCount - 1} data-testid={testId ? `${testId}-next` : undefined}
                className="w-8 h-8 rounded-lg border border-line flex items-center justify-center text-muted hover:text-brand hover:border-brand disabled:opacity-40 disabled:hover:text-muted disabled:hover:border-line"><ChevronRight size={16} /></button>
            </div>
          )}
        </div>
      )}

      {open && anchor && openCol?.filter &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(null)} />
            <div
              ref={popover}
              data-testid={testId ? `filter-pop-${open}` : undefined}
              className="fixed z-[9999] w-56 lf-card p-2 shadow-pop"
              style={{ top: anchor.top, left: anchor.left }}
            >
              {openCol.filter.kind === 'text' ? (
                <div className="relative">
                  <input
                    autoFocus
                    value={filters[open] ?? ''}
                    onChange={(e) => setFilter(open, e.target.value)}
                    placeholder={`Filter ${openCol.header}…`}
                    className="w-full h-9 px-3 pr-7 rounded-lg bg-canvas dark:bg-dk-elevated border border-line text-sm outline-none focus:border-brand"
                  />
                  {filters[open] && <button onClick={() => setFilter(open, '')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-danger-strong"><X size={14} /></button>}
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto scroll-thin flex flex-col gap-0.5">
                  <button onClick={() => { setFilter(open, ''); setOpen(null) }} className={clsx('px-2.5 py-1.5 rounded-lg text-sm text-left hover:bg-brand/5', !filters[open] && 'bg-brand/10 text-brand font-semibold')}>{t('table.all')}</button>
                  {openCol.filter.options.map((o) => (
                    <button key={o.value} onClick={() => { setFilter(open, o.value); setOpen(null) }} className={clsx('px-2.5 py-1.5 rounded-lg text-sm text-left hover:bg-brand/5', filters[open] === o.value && 'bg-brand/10 text-brand font-semibold')}>{o.label}</button>
                  ))}
                </div>
              )}
            </div>
          </>,
          document.body,
        )}
    </div>
  )
}
