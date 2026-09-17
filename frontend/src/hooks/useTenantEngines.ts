import { useMemo } from 'react';

import { useAuthStore } from '@/store/auth';
import { ENGINE_META, VISIBLE_ENGINES, engineLabel } from '@/config/engineMeta';
import type { EngineKind } from '@/api/types';

/**
 * The activities this organisation has adopted.
 *
 * Every activity is a coded module registered once in the platform's catalogue — Shop & Drop,
 * Mobility, Lagoon, and whatever is added next. An organisation adopts the ones it runs, and
 * that list is what every screen offering "which activity?" is built from.
 *
 * This is the reason no screen needs to ask which company it is serving. A filter tab, a kind
 * picker, a counter tile and a settings page all render the same thing — the adopted list —
 * and differ between organisations only because the list differs. There is no `if WAYZ`
 * anywhere, and adding an organisation that runs two of the three requires no change here.
 *
 * Falls back to the whole catalogue when the session carries nothing, which happens only
 * before the first `/me` resolves; an empty list would flash an empty picker on every reload.
 */
export function useTenantEngines(): EngineKind[] {
  const adopted = useAuthStore((s) => s.me?.tenant?.enabledEngines);

  return useMemo(() => {
    const held = adopted ?? [];
    if (held.length === 0) return VISIBLE_ENGINES;

    /*
     * Ordered by the catalogue, so two organisations running the same activities list them the
     * same way. Anything the session names that the catalogue does not know is kept rather than
     * dropped — a server that has shipped an activity this build has not heard of should show
     * as an unfamiliar name, not vanish.
     */
    const known = VISIBLE_ENGINES.filter((kind) => held.includes(kind));
    const unknown = held.filter((kind) => !VISIBLE_ENGINES.includes(kind));
    return [...known, ...unknown];
  }, [adopted]);
}

/** The same list, shaped for a `<Select>`. */
export function useTenantEngineOptions(): { label: string; value: EngineKind }[] {
  const engines = useTenantEngines();
  return useMemo(() => engines.map((k) => ({ label: engineLabel(k), value: k })), [engines]);
}

/** The catalogue entry for each adopted activity — label, icon, route. */
export function useTenantEngineMeta() {
  const engines = useTenantEngines();
  return useMemo(() => engines.map((kind) => ({ kind, ...ENGINE_META[kind] })), [engines]);
}
