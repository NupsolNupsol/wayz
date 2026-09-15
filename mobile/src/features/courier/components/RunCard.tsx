import { Pressable, Text, View } from 'react-native'

import { Icon } from '@/components/Icon'
import { relativeTime } from '@/lib/format'
import { SHADOW, TONE_HEX } from '@/theme/tokens'

import { meta } from '../model'
import type { Delivery } from '../types'

/**
 * One run, as a card.
 *
 * Built for a glance at arm's length: the customer at the top, where it is going underneath, and
 * the state as a coloured chip. The whole card is the target — a courier is often one-handed and
 * moving, so a small chevron would be a poor hit area.
 */
export function RunCard({
  run,
  onPress,
  action,
  highlight = false,
  testID,
}: {
  run: Delivery
  onPress: () => void
  action?: React.ReactNode
  highlight?: boolean
  testID?: string
}) {
  const m = meta(run.status)
  const hex = TONE_HEX[m.tone]
  const stops = run.stops ?? []
  const bagCount = stops.length
    ? stops.reduce((sum, s) => sum + s.bagCount, 0)
    : run.scannedBarcodes.length || null
  const gate = run.destination.kind === 'GATE' || !!run.destination.kioskName

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${run.customerName}, ${m.label}`}
      onPress={onPress}
      testID={testID ?? `run-card-${run._id}`}
      className={`rounded-xl3 border bg-surface p-4 active:opacity-80 ${
        highlight ? 'border-brand/40' : 'border-line'
      }`}
      style={SHADOW.card}
    >
      <View className="flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${hex}1a` }}>
          <Icon name={m.icon} size={19} color={hex} />
        </View>

        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            <Text numberOfLines={1} className="min-w-0 flex-1 text-[15px] font-bold text-navy">
              {run.customerName}
            </Text>
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${hex}1a` }}>
              <Text className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: hex }}>
                {m.label}
              </Text>
            </View>
          </View>

          <View className="mt-1 flex-row items-start gap-1.5">
            <View className="pt-0.5">
              <Icon name={gate ? 'DoorOpen' : 'MapPin'} size={13} color={TONE_HEX.neutral} />
            </View>
            <Text numberOfLines={2} className="min-w-0 flex-1 text-[13px] leading-[17px] text-muted">
              {run.destination.address}
            </Text>
          </View>

          <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1">
            <Text className="font-mono text-[11px] text-faint">{run._id}</Text>
            {stops.length > 1 ? (
              <View className="flex-row items-center gap-1">
                <Icon name="Route" size={11} color={TONE_HEX.neutral} />
                <Text className="text-[11px] text-muted">{stops.length} desks</Text>
              </View>
            ) : null}
            {bagCount ? (
              <View className="flex-row items-center gap-1">
                <Icon name="Package" size={11} color={TONE_HEX.neutral} />
                <Text className="text-[11px] text-muted">
                  {bagCount} bag{bagCount === 1 ? '' : 's'}
                </Text>
              </View>
            ) : null}
            <View className="flex-row items-center gap-1">
              <Icon name="Clock" size={11} color={TONE_HEX.neutral} />
              <Text className="text-[11px] text-muted">{relativeTime(run.requestedAt)}</Text>
            </View>
          </View>
        </View>
      </View>

      <View className="mt-3 flex-row items-center gap-2 rounded-2xl bg-canvas px-3 py-2">
        <Icon name="ArrowRight" size={13} color={hex} />
        <Text numberOfLines={2} className="min-w-0 flex-1 text-[12px] leading-4 text-navy">
          {m.hint}
        </Text>
      </View>

      {action ? <View className="mt-3">{action}</View> : null}
    </Pressable>
  )
}
