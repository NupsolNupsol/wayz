import { clsx } from 'clsx'
import { Check, Lock } from 'lucide-react'

import type { CapabilityDef, ProfileDef } from './platformApi'

const GROUPS: { key: CapabilityDef['group']; label: string }[] = [
  { key: 'OPERATIONS', label: 'Operations' },
  { key: 'DOMAIN', label: 'Domain' },
  { key: 'BACK_OFFICE', label: 'Back office' },
]

/**
 * What a tenant may do, and therefore who it may hire.
 *
 * The two lists are one control because they are one decision. A profile is a job, and a job
 * exists only where there is work for it: a company that never enabled boats has no use for
 * a captain, and offering the option would put a role in their navigation that leads to an
 * empty screen. So turning a capability off takes its jobs away with it — visibly, rather
 * than by leaving a checkbox that quietly does nothing.
 *
 * This is also what keeps one tenant's vocabulary out of another's. Nobody writes down that
 * a horse-tour company should not see "Shop & Drop agent"; it simply never enabled bag
 * storage, so that job is not among the ones it can staff.
 */
export function CapabilityPicker({
  vocabulary,
  capabilities,
  profiles,
  onCapabilities,
  onProfiles,
}: {
  vocabulary: { capabilities: CapabilityDef[]; profiles: ProfileDef[] } | null
  capabilities: string[]
  profiles: string[]
  onCapabilities: (next: string[]) => void
  onProfiles: (next: string[]) => void
}) {
  if (!vocabulary) return <p className="text-sm text-muted">Loading…</p>

  const held = new Set(capabilities)
  const available = vocabulary.profiles.filter((p) => p.requires.every((c) => held.has(c)))

  const toggleCapability = (key: string) => {
    const next = held.has(key) ? capabilities.filter((c) => c !== key) : [...capabilities, key]
    onCapabilities(next)

    // A job whose capability just went away goes with it, rather than lingering as a setting
    // that no longer means anything.
    const stillHeld = new Set(next)
    onProfiles(
      profiles.filter((key2) => {
        const def = vocabulary.profiles.find((p) => p.key === key2)
        return !def || def.requires.every((c) => stillHeld.has(c))
      }),
    )
  }

  const toggleProfile = (key: string) => {
    // The tenant administrator is not optional: somebody has to be able to sign in and set
    // the company up, and that is the account provisioning creates.
    if (key === 'TENANT_ADMIN') return
    onProfiles(profiles.includes(key) ? profiles.filter((p) => p !== key) : [...profiles, key])
  }

  return (
    <div>
      {GROUPS.map((group) => {
        const rows = vocabulary.capabilities.filter((c) => c.group === group.key)
        if (rows.length === 0) return null
        return (
          <div key={group.key} className="mb-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">{group.label}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {rows.map((c) => {
                const on = held.has(c.key)
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => toggleCapability(c.key)}
                    aria-pressed={on}
                    data-testid={`capability-${c.key}`}
                    className={clsx(
                      'text-start rounded-xl border p-3 transition-colors',
                      on
                        ? 'bg-canvas border-line'
                        : 'bg-canvas border-line hover:border-line',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={clsx(
                          'w-4 h-4 rounded flex items-center justify-center shrink-0',
                          on ? 'bg-brand text-brand-fg border border-brand' : 'border border-line bg-surface text-ink',
                        )}
                      >
                        {on && <Check size={11} strokeWidth={3} />}
                      </span>
                      <span className="text-sm font-semibold">{c.label}</span>
                    </span>
                    <span className="block text-[11px] text-muted mt-1 ps-6">{c.blurb}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2 mt-6">
        Jobs they can staff
      </p>
      <p className="text-[11px] text-muted mb-2.5">
        Only the jobs their capabilities give work to. Turning a capability off removes its jobs.
      </p>
      <div className="flex flex-wrap gap-2" data-testid="profile-picker">
        {available.map((p) => {
          const on = profiles.includes(p.key)
          const fixed = p.key === 'TENANT_ADMIN'
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => toggleProfile(p.key)}
              aria-pressed={on}
              title={p.blurb}
              data-testid={`profile-${p.key}`}
              className={clsx(
                'rounded-xl border px-3 py-2 text-sm font-semibold inline-flex items-center gap-2 transition-colors',
                on ? 'bg-brand/10 border-brand text-ink font-semibold' : 'bg-canvas border-line text-muted hover:border-line',
                fixed && 'cursor-default',
              )}
            >
              {fixed && <Lock size={12} className="text-muted" />}
              {p.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
