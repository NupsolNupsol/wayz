import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { clsx } from 'clsx'
import { COUNTRIES, DEFAULT_COUNTRY, type Country } from '@/config/countries'

function parse(value: string): { country: Country; local: string } {
  const v = (value ?? '').trim()
  if (v.startsWith('+')) {
    const match = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length).find((c) => v.startsWith(c.dial))
    if (match) return { country: match, local: v.slice(match.dial.length).trim() }
  }
  return { country: DEFAULT_COUNTRY, local: v }
}

export function PhoneInput({
  value,
  onChange,
  testId,
  id,
  placeholder = '5xxxxxxxx',
}: {
  value: string
  onChange: (full: string) => void
  testId?: string
  id?: string
  placeholder?: string
}) {
  const parsed = parse(value)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState<Country>(parsed.country)
  const [local, setLocal] = useState(parsed.local)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const p = parse(value)
    setCountry(p.country)
    setLocal(p.local)
  }, [value])

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const emit = (c: Country, l: string) => onChange(`${c.dial} ${l}`.trim())
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return COUNTRIES
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.iso2.toLowerCase() === q)
  }, [search])

  return (
    <div className="relative flex items-stretch gap-2" ref={ref} data-testid={testId}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          data-testid={testId ? `${testId}-country` : undefined}
          className="lf-input !w-auto flex items-center gap-1.5 pe-2.5 min-w-[92px] justify-between"
        >
          <span className="text-xs font-semibold text-muted">{country.iso2}</span>
          <span className="font-mono text-sm">{country.dial}</span>
          <ChevronDown size={14} className="text-muted" />
        </button>
        {open && (
          <div className="absolute z-[9999] top-[calc(100%+6px)] start-0 w-72 lf-card p-0 shadow-pop overflow-hidden" data-testid={testId ? `${testId}-menu` : undefined}>
            <div className="p-2 border-b border-line">
              <div className="relative">
                <Search size={15} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search country or code…" className="lf-input !h-9 ps-8" data-testid={testId ? `${testId}-search` : undefined} />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto scroll-thin">
              {filtered.map((c) => (
                <button
                  key={c.iso2 + c.dial}
                  type="button"
                  onClick={() => { setCountry(c); emit(c, local); setOpen(false); setSearch('') }}
                  data-testid={testId ? `${testId}-opt-${c.iso2}` : undefined}
                  className={clsx('w-full flex items-center gap-2 px-3 py-2 text-sm text-start hover:bg-canvas dark:hover:bg-dk-elevated', c.iso2 === country.iso2 && 'bg-brand/5')}
                >
                  <span className="text-[11px] font-bold text-muted w-6">{c.iso2}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="font-mono text-xs text-muted">{c.dial}</span>
                </button>
              ))}
              {filtered.length === 0 && <p className="p-3 text-sm text-muted text-center">No match</p>}
            </div>
          </div>
        )}
      </div>
      <input
        id={id}
        inputMode="tel"
        className="lf-input flex-1"
        value={local}
        placeholder={placeholder}
        onChange={(e) => { const l = e.target.value.replace(/[^\d ]/g, ''); setLocal(l); emit(country, l) }}
        data-testid={testId ? `${testId}-number` : undefined}
      />
    </div>
  )
}
