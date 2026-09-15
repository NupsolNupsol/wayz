import { useMemo } from 'react'

import { useAuthStore } from '@/store/auth'
import { engineLabel, visibleEngines } from '@/config/engineMeta'
import type { EngineKind } from '@/api/types'

/**
 * The built-in activities *this* company runs.
 *
 * Every screen that offers a list of activities — the asset filters, the kind picker, the
 * company settings — used to render a constant holding WAYZ's three. A company that runs horse
 * rides was therefore offered "Shop & Drop", "Mobility Rentals" and "Lagoon": three activities
 * it does not have, cannot staff and will never sell. The navigation had been fixed to ask
 * about capabilities; these screens had not, so they kept the old assumption alive.
 *
 * Capabilities come from the control-plane registry by way of the session, which is the same
 * source the sidebar uses — one answer to "what does this company do", not two.
 */
export function useTenantEngines(): EngineKind[] {
  const capabilities = useAuthStore((s) => s.me?.tenant?.capabilities)
  return useMemo(() => visibleEngines(capabilities), [capabilities])
}

/** The same list, shaped for a `<Select>`. */
export function useTenantEngineOptions(): { label: string; value: EngineKind }[] {
  const engines = useTenantEngines()
  return useMemo(() => engines.map((k) => ({ label: engineLabel(k), value: k })), [engines])
}
