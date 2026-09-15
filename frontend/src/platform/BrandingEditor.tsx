import { useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'

import type { TenantBranding } from './platformApi'
import { ColourInput, Labelled, PlatformCard, SectionHeading, TextInput } from './components'

export const defaultBranding: TenantBranding = {
  primaryColor: '#1a3470',
  secondaryColor: '#204897',
  accentColor: '#4f8ef7',
  logoUrl: null,
  logoText: '',
  faviconUrl: null,
}

/** The same cap the server enforces, said here so the refusal happens before the upload. */
const LOGO_MAX_BYTES = 512 * 1024

/**
 * Branding, with the thing it changes shown beside it.
 *
 * A colour picker on its own is a guess: two navies look identical in a swatch and quite
 * different behind white text on a sidebar. So the preview is not decoration — it is the
 * only honest way to choose, and it renders the actual pieces the colours land on: the
 * sidebar, a primary button, a link, a badge.
 */
export function BrandingEditor({
  value,
  onChange,
  tenantName,
}: {
  value: TenantBranding
  onChange: (b: TenantBranding) => void
  tenantName: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [problem, setProblem] = useState('')

  const set = (patch: Partial<TenantBranding>) => onChange({ ...value, ...patch })

  const pickLogo = (file: File) => {
    setProblem('')
    if (!/^image\/(png|jpeg|svg\+xml|webp)$/.test(file.type)) {
      setProblem('Use a PNG, JPEG, SVG or WebP image.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const uri = String(reader.result ?? '')
      // Base64 is about a third larger than the file, so the check is on what actually gets
      // stored rather than on what was picked.
      if (uri.length > LOGO_MAX_BYTES) {
        setProblem(`That image is too large — keep it under ${Math.round(LOGO_MAX_BYTES / 1024)} KB.`)
        return
      }
      set({ logoUrl: uri })
    }
    reader.onerror = () => setProblem('That file could not be read.')
    reader.readAsDataURL(file)
  }

  const initials = (value.logoText || tenantName).slice(0, 2).toUpperCase()

  return (
    <PlatformCard testId="branding-editor">
      <SectionHeading title="Branding" blurb="What their staff see, everywhere in their workspace." />

      <Labelled label="Logo" hint="PNG, JPEG, SVG or WebP, under 512 KB." problem={problem || undefined}>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-white/90 flex items-center justify-center overflow-hidden shrink-0">
            {value.logoUrl ? (
              <img src={value.logoUrl} alt="" className="w-full h-full object-contain p-1.5" data-testid="branding-logo-preview" />
            ) : (
              <span className="font-extrabold" style={{ color: value.primaryColor }}>
                {initials}
              </span>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            data-testid="branding-logo-input"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) pickLogo(f)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            data-testid="branding-logo-pick"
            className="h-10 px-3.5 rounded-xl bg-canvas border border-line text-ink hover:text-ink hover:bg-canvas text-sm font-semibold inline-flex items-center gap-2"
          >
            <ImagePlus size={15} /> Upload
          </button>
          {value.logoUrl && (
            <button
              type="button"
              onClick={() => set({ logoUrl: null })}
              data-testid="branding-logo-clear"
              className="h-10 w-10 rounded-xl bg-canvas border border-line text-muted hover:text-danger-strong inline-flex items-center justify-center"
              aria-label="Remove the logo"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </Labelled>

      <Labelled label="Short mark" hint="Two letters, used where a full logo does not fit.">
        <TextInput value={value.logoText} onChange={(v) => set({ logoText: v.slice(0, 4) })} placeholder={initials} testId="branding-logo-text" />
      </Labelled>

      <Labelled label="Primary">
        <ColourInput value={value.primaryColor} onChange={(v) => set({ primaryColor: v })} testId="branding-primary" />
      </Labelled>
      <Labelled label="Secondary">
        <ColourInput value={value.secondaryColor} onChange={(v) => set({ secondaryColor: v })} testId="branding-secondary" />
      </Labelled>
      <Labelled label="Accent">
        <ColourInput value={value.accentColor} onChange={(v) => set({ accentColor: v })} testId="branding-accent" />
      </Labelled>

      <SectionHeading title="Preview" blurb="Roughly what their workspace looks like." />
      <div className="rounded-2xl overflow-hidden border border-line" data-testid="branding-preview">
        <div className="flex h-[172px]">
          <div
            className="w-[86px] p-3 flex flex-col gap-2 shrink-0"
            style={{ background: `linear-gradient(160deg, ${value.primaryColor}, ${value.secondaryColor})` }}
            data-testid="branding-preview-sidebar"
          >
            <div className="w-8 h-8 rounded-lg bg-canvas flex items-center justify-center overflow-hidden">
              {value.logoUrl ? (
                <img src={value.logoUrl} alt="" className="w-full h-full object-contain p-0.5" />
              ) : (
                <span className="text-[10px] font-extrabold text-white">{initials}</span>
              )}
            </div>
            <div className="h-2 rounded bg-muted/30 w-full" />
            <div className="h-2 rounded bg-canvas w-4/5" />
            <div className="h-2 rounded bg-canvas w-3/5" />
          </div>

          <div className="flex-1 bg-[#f6f8fb] p-3.5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-2.5 w-24 rounded" style={{ background: value.primaryColor, opacity: 0.85 }} />
              <div
                className="text-[10px] font-bold rounded-full px-2 py-0.5"
                style={{ background: `${value.accentColor}22`, color: value.accentColor }}
              >
                Badge
              </div>
            </div>
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <div className="h-2 w-3/4 rounded bg-slate-200 mb-2" />
              <div className="h-2 w-1/2 rounded bg-slate-100 mb-3" />
              <div className="flex items-center gap-2">
                <div
                  className="h-7 px-3 rounded-lg text-[10px] font-bold text-white flex items-center"
                  style={{ background: value.primaryColor }}
                  data-testid="branding-preview-button"
                >
                  Confirm
                </div>
                <span className="text-[10px] font-semibold" style={{ color: value.accentColor }}>
                  A link
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PlatformCard>
  )
}
