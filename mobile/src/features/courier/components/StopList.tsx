import { Text, View } from 'react-native'

import { Heading, Icon, Muted } from '@/design'
import { COLORS, SHADOW } from '@/theme/tokens'

import type { DeliveryStop } from '../types'

/**
 * A customer's bags can be sitting at more than one desk. This is the walking order: which desk is
 * next, which are done, and how many bags come off each — so the courier does not have to hold the
 * route in their head.
 */
export function StopList({ stops, testID }: { stops: DeliveryStop[]; testID?: string }) {
  const collected = stops.filter((s) => s.status === 'COLLECTED').length

  return (
    <View className="gap-3" testID={testID}>
      <View className="flex-row items-center justify-between">
        <Heading>Desks on this run</Heading>
        <Muted>
          {collected} of {stops.length} done
        </Muted>
      </View>

      <View className="rounded-xl3 border border-line bg-surface p-3" style={SHADOW.card}>
        {stops.map((stop, index) => {
          const done = stop.status === 'COLLECTED'
          const active = !!stop.active
          const last = index === stops.length - 1

          return (
            <View key={stop.bookingId} className="flex-row gap-3" testID={`stop-${stop.bookingId}`}>
              <View className="items-center">
                <View
                  className={`h-8 w-8 items-center justify-center rounded-full ${
                    done ? 'bg-success/15' : active ? 'bg-brand' : 'bg-canvas'
                  }`}
                >
                  {done ? (
                    <Icon name="Check" size={15} color={COLORS.success} strokeWidth={2.6} />
                  ) : (
                    <Text className={`text-[12px] font-extrabold ${active ? 'text-white' : 'text-faint'}`}>
                      {index + 1}
                    </Text>
                  )}
                </View>
                {!last ? <View className={`w-[2px] flex-1 ${done ? 'bg-success/30' : 'bg-line'}`} /> : null}
              </View>

              <View className={`min-w-0 flex-1 ${last ? 'pb-1' : 'pb-4'} pt-1`}>
                <View className="flex-row items-center gap-2">
                  <Text
                    numberOfLines={1}
                    className={`min-w-0 flex-1 text-[14px] font-bold ${done ? 'text-muted' : 'text-navy'}`}
                  >
                    {stop.kioskName}
                  </Text>
                  {active ? (
                    <View className="rounded-full bg-brand-soft px-2 py-0.5" testID={`stop-${stop.bookingId}-now`}>
                      <Text className="text-[10px] font-extrabold uppercase tracking-wide text-brand-ink">Go here</Text>
                    </View>
                  ) : done ? (
                    <Text className="text-[11px] font-bold text-success">Collected</Text>
                  ) : (
                    <Text className="text-[11px] text-faint">Queued</Text>
                  )}
                </View>

                <Text numberOfLines={1} className="mt-0.5 text-[12px] text-muted">
                  {stop.assetUnitIdentifier ? `${stop.assetUnitIdentifier} · ` : ''}
                  {stop.bagCount} bag{stop.bagCount === 1 ? '' : 's'} · {stop.bookingRef}
                </Text>
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}
