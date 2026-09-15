import { useMemo, type ReactNode } from 'react'
import { MapPin, Package, ShoppingBasket, Users } from 'lucide-react'

import type { ActivityDraft, ActivityGraphOptions } from '@/api/activity.api'

/**
 * Where an activity runs, who runs it, and what it runs on.
 *
 * This tab is the operating graph, and the graph is what replaced the platform knowing what a
 * tenant sells. Nothing downstream asks "which engine is this" any more; it asks the activity
 * where it runs and who may work it, and the answers are set on this screen.
 *
 * Three consequences follow from what is chosen here, and each is stated on the panel it
 * belongs to rather than buried in documentation nobody opens:
 *
 *  - a counter offers the activities that name it, so an activity naming no counter is sold
 *    nowhere;
 *  - a job may only be assigned an activity that admits it, which is what stops a horse
 *    trainer being offered the camel tour;
 *  - an employee sees the resources of the activities they work at the places they are
 *    posted, which is what stops one location's trainer seeing another location's animals.
 *
 * **Empty means unrestricted on that axis**, never "nothing". A company with one location
 * should not have to enumerate it before anything works. The rule is invariant across every
 * list here, said once at the top and then again on each panel where an empty list would
 * otherwise read as an oversight.
 */

interface PickListProps {
  title: string
  blurb: string
  icon: ReactNode
  options: { id: string; label: string; group?: string }[]
  selected: string[]
  onChange: (next: string[]) => void
  /** What an empty selection means here, said in the tenant's own terms. */
  emptyMeans: string
  testId: string
}

function PickList({ title, blurb, icon, options, selected, onChange, emptyMeans, testId }: PickListProps) {
  const grouped = useMemo(() => {
    const by = new Map<string, PickListProps['options']>()
    for (const o of options) by.set(o.group ?? '', [...(by.get(o.group ?? '') ?? []), o])
    return [...by.entries()]
  }, [options])

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])

  return (
    <section className="rounded-2xl border border-line bg-surface p-4" data-testid={testId}>
      <header className="flex items-start gap-2.5 mb-3">
        <span className="text-muted mt-0.5">{icon}</span>
        <div className="min-w-0">
          <h3 className="text-[13px] font-bold text-ink">{title}</h3>
          <p className="text-[12px] text-muted mt-0.5">{blurb}</p>
        </div>
        {options.length > 0 && (
          <button
            type="button"
            onClick={() => onChange(selected.length === options.length ? [] : options.map((o) => o.id))}
            className="ms-auto shrink-0 text-[12px] font-semibold text-brand hover:underline"
            data-testid={testId + '-all'}
          >
            {selected.length === options.length ? 'Clear' : 'Select all'}
          </button>
        )}
      </header>

      {options.length === 0 ? (
        <p className="text-[12px] text-muted italic">Nothing to choose from yet.</p>
      ) : (
        <div className="space-y-3">
          {grouped.map(([group, items]) => (
            <div key={group}>
              {group && (
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5">{group}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {items.map((o) => {
                  const on = selected.includes(o.id)
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggle(o.id)}
                      aria-pressed={on}
                      data-testid={testId + '-' + o.id}
                      className={
                        on
                          ? 'px-2.5 h-8 rounded-lg text-[12px] font-semibold bg-brand text-white'
                          : 'px-2.5 h-8 rounded-lg text-[12px] font-medium border border-line text-muted hover:text-ink hover:border-brand/50'
                      }
                    >
                      {o.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected.length === 0 && options.length > 0 && (
        <p className="text-[12px] text-muted mt-3 pt-3 border-t border-line">{emptyMeans}</p>
      )}
    </section>
  )
}

export interface ActivityGraphTabProps {
  draft: ActivityDraft
  graph: ActivityGraphOptions | null
  edit: (patch: Partial<ActivityDraft>) => void
}

export function ActivityGraphTab({ draft, graph, edit }: ActivityGraphTabProps) {
  /*
   * Areas and counters are shown under the thing that contains them, and narrowed by what has
   * already been chosen above. Somebody who has picked one location should not have to read
   * past two others' areas to find theirs.
   */
  const areaOptions = useMemo(() => {
    if (!graph) return []
    const sites = new Map(graph.sites.map((s) => [s.id, s.name]))
    return graph.areas
      .filter((a) => draft.siteIds.length === 0 || draft.siteIds.includes(a.siteId))
      .map((a) => ({ id: a.id, label: a.name, group: sites.get(a.siteId) ?? 'Unplaced' }))
  }, [graph, draft.siteIds])

  const terminalOptions = useMemo(() => {
    if (!graph) return []
    const areas = new Map(graph.areas.map((a) => [a.id, a.name]))
    const within = new Set(areaOptions.map((a) => a.id))
    return graph.terminals
      .filter((t) => within.has(t.areaId))
      .filter((t) => draft.areaIds.length === 0 || draft.areaIds.includes(t.areaId))
      .map((t) => ({ id: t.id, label: t.name, group: areas.get(t.areaId) ?? 'Unplaced' }))
  }, [graph, areaOptions, draft.areaIds])

  /*
   * Named resources are offered only from the kinds this activity uses. Picking individual
   * animals out of a list of every animal the company owns is not a decision anybody makes
   * well, and choosing the kinds is the decision that comes first anyway.
   */
  const resourceOptions = useMemo(() => {
    if (!graph || draft.assetTypeIds.length === 0) return []
    const kinds = new Map(graph.resourceKinds.map((k) => [k.id, k.name]))
    const areas = new Map(graph.areas.map((a) => [a.id, a.name]))
    return graph.resources
      .filter((r) => draft.assetTypeIds.includes(r.kindId))
      .filter((r) => draft.areaIds.length === 0 || !r.areaId || draft.areaIds.includes(r.areaId))
      .map((r) => ({
        id: r.id,
        label: r.areaId ? r.identifier + ' · ' + (areas.get(r.areaId) ?? '') : r.identifier,
        group: kinds.get(r.kindId) ?? 'Resources',
      }))
  }, [graph, draft.assetTypeIds, draft.areaIds])

  if (!graph) {
    return (
      <div data-testid="activity-panel-graph">
        <p className="text-[13px] text-muted">Loading what this company has to work with…</p>
      </div>
    )
  }

  /*
   * Narrowing a parent must not leave orphans behind it. Deselecting a location whose areas
   * were chosen would otherwise leave those areas in the draft — invisible on screen and still
   * governing who sees what, which is a bug that only surfaces once somebody is in the wrong
   * place.
   */
  const setSites = (siteIds: string[]) => {
    const keptAreas = new Set(
      graph.areas.filter((a) => siteIds.length === 0 || siteIds.includes(a.siteId)).map((a) => a.id),
    )
    const areaIds = draft.areaIds.filter((id) => keptAreas.has(id))
    const keptTerminals = new Set(
      graph.terminals.filter((t) => areaIds.length === 0 || areaIds.includes(t.areaId)).map((t) => t.id),
    )
    edit({ siteIds, areaIds, terminalIds: draft.terminalIds.filter((id) => keptTerminals.has(id)) })
  }

  const setAreas = (areaIds: string[]) => {
    const kept = new Set(
      graph.terminals.filter((t) => areaIds.length === 0 || areaIds.includes(t.areaId)).map((t) => t.id),
    )
    edit({ areaIds, terminalIds: draft.terminalIds.filter((id) => kept.has(id)) })
  }

  const setKinds = (assetTypeIds: string[]) => {
    const kept = new Set(graph.resources.filter((r) => assetTypeIds.includes(r.kindId)).map((r) => r.id))
    edit({ assetTypeIds, eligibleResourceIds: draft.eligibleResourceIds.filter((id) => kept.has(id)) })
  }

  return (
    <div className="space-y-4 max-w-3xl" data-testid="activity-panel-graph">
      <p className="text-[13px] text-muted">
        Where this activity runs, who may run it, and what it runs on. Leaving a list empty means it is not
        restricted on that axis — not that nothing is allowed.
      </p>

      <PickList
        title="Locations"
        blurb="The sites this activity is offered at."
        icon={<MapPin size={16} />}
        options={graph.sites.map((s) => ({ id: s.id, label: s.name }))}
        selected={draft.siteIds}
        onChange={setSites}
        emptyMeans="Offered at every location the company operates."
        testId="graph-sites"
      />

      <PickList
        title="Areas"
        blurb="The areas within those locations where it actually takes place."
        icon={<MapPin size={16} />}
        options={areaOptions}
        selected={draft.areaIds}
        onChange={setAreas}
        emptyMeans="Takes place anywhere within the chosen locations."
        testId="graph-areas"
      />

      <PickList
        title="Counters"
        blurb="The counters that may sell it. A counter offers exactly the activities that name it."
        icon={<ShoppingBasket size={16} />}
        options={terminalOptions}
        selected={draft.terminalIds}
        onChange={(terminalIds) => edit({ terminalIds })}
        emptyMeans="Sold at every counter in the chosen areas."
        testId="graph-terminals"
      />

      <PickList
        title="Jobs that run it"
        blurb="Only these jobs may be assigned this activity when somebody is hired or reassigned."
        icon={<Users size={16} />}
        options={graph.roles.map((r) => ({ id: r.key, label: r.label }))}
        selected={draft.operatorRoleKeys}
        onChange={(operatorRoleKeys) => edit({ operatorRoleKeys })}
        emptyMeans="Any job the company has defined may be assigned this activity."
        testId="graph-roles"
      />

      <PickList
        title="Kinds of resource it uses"
        blurb="What this activity needs in order to run — the horses, the boats, the machines."
        icon={<Package size={16} />}
        options={graph.resourceKinds.map((k) => ({ id: k.id, label: k.name }))}
        selected={draft.assetTypeIds}
        onChange={setKinds}
        emptyMeans="Uses no resource. Nothing is held when it is booked."
        testId="graph-kinds"
      />

      {draft.assetTypeIds.length > 0 && (
        <PickList
          title="Named resources"
          blurb="Narrow it to particular ones — say, the four horses trained for beginners."
          icon={<Package size={16} />}
          options={resourceOptions}
          selected={draft.eligibleResourceIds}
          onChange={(eligibleResourceIds) => edit({ eligibleResourceIds })}
          emptyMeans="Any resource of the kinds above, wherever it stands."
          testId="graph-resources"
        />
      )}

      <PickList
        title="Products it consumes"
        blurb="Stock drawn down each time it runs, so the count falls without anybody keying it in."
        icon={<ShoppingBasket size={16} />}
        options={graph.products.map((p) => ({ id: p.id, label: p.name }))}
        selected={draft.consumableProductIds}
        onChange={(consumableProductIds) => edit({ consumableProductIds })}
        emptyMeans="Consumes nothing. Running it does not move stock."
        testId="graph-products"
      />
    </div>
  )
}
