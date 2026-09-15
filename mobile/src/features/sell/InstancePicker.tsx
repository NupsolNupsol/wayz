import { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { EmptyState, Icon, Input, Muted, Segmented, StatusPill } from '@/design'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { COLORS } from '@/theme/tokens'
import type { AssetUnit } from '@/types'
import { isFree, unitCaption } from './model'

type Show = 'free' | 'all'

/**
 * Which actual one they are getting — this scooter, that compartment, this boat.
 *
 * Picking a *kind* is not enough: the server binds a sale to a named unit at this desk, and will
 * refuse one that is busy or belongs elsewhere. So the agent chooses from what is really on the
 * floor in front of them, free ones first, with the taken ones visible but unselectable so nobody
 * hunts for a compartment that is simply occupied.
 */
export function InstancePicker({
  units,
  value,
  onChange,
  label = 'Which one',
  caption,
  emptyMessage = 'Nothing of this kind is free at your desk right now.',
  testID = 'instances',
}: {
  units: AssetUnit[]
  value: string
  onChange: (unitId: string) => void
  label?: string
  /** What to say under the name. A boat says how many seats are *left*, not how many it has. */
  caption?: ((unit: AssetUnit) => string) | undefined
  emptyMessage?: string
  testID?: string
}) {
  const { columns } = useDeviceClass()
  const [show, setShow] = useState<Show>('free')
  const [query, setQuery] = useState('')

  const free = useMemo(() => units.filter(isFree), [units])
  const rows = useMemo(() => {
    const base = show === 'free' ? free : units
    const term = query.trim().toLowerCase()
    const found = term ? base.filter((u) => u.identifier.toLowerCase().includes(term)) : base
    // Free first, then by name, so the useful half of a long list is always at the top.
    return [...found].sort((a, b) => Number(isFree(b)) - Number(isFree(a)) || a.identifier.localeCompare(b.identifier))
  }, [free, units, show, query])

  const say = caption ?? unitCaption
  const perRow = columns >= 4 ? 3 : columns >= 3 ? 2 : 1

  return (
    <View className="gap-3" testID={testID}>
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</Text>
        <Muted className="text-[11px]" testID={`${testID}-count`}>
          {free.length} of {units.length} free
        </Muted>
      </View>

      {units.length > 6 ? (
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Find by number"
          autoCapitalize="characters"
          autoCorrect={false}
          testID={`${testID}-search`}
        />
      ) : null}

      <Segmented
        value={show}
        onChange={setShow}
        testID={`${testID}-filter`}
        options={[
          { value: 'free', label: 'Free', count: free.length },
          { value: 'all', label: 'All', count: units.length },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Icon name="Grid3x3" size={22} color={COLORS.faint} />}
          title={show === 'free' ? 'None free' : 'Nothing here'}
          message={emptyMessage}
          testID={`${testID}-empty`}
        />
      ) : (
        <View className="-mx-1 flex-row flex-wrap">
          {rows.map((unit) => {
            const open = isFree(unit)
            const chosen = unit._id === value
            return (
              <View
                key={unit._id}
                style={{ width: `${100 / perRow}%` as unknown as number }}
                className="px-1 pb-2"
              >
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: chosen, disabled: !open }}
                  accessibilityLabel={`${unit.identifier}. ${say(unit) || 'available'}`}
                  disabled={!open}
                  onPress={() => onChange(chosen ? '' : unit._id)}
                  testID={`${testID}-${unit._id}`}
                  className={`gap-1 rounded-2xl border p-3 ${
                    chosen ? 'border-brand bg-brand-soft' : open ? 'border-line bg-surface' : 'border-line bg-canvas opacity-60'
                  }`}
                >
                  <View className="flex-row items-center justify-between gap-2">
                    <Text numberOfLines={1} className="text-[15px] font-extrabold text-navy">
                      {unit.identifier}
                    </Text>
                    {chosen ? <Icon name="Check" size={15} color={COLORS.brand} /> : null}
                  </View>
                  {open ? (
                    <Muted numberOfLines={2} className="text-[11px]">
                      {say(unit) || 'Free'}
                    </Muted>
                  ) : (
                    <StatusPill status={unit.status} size="sm" />
                  )}
                </Pressable>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}
