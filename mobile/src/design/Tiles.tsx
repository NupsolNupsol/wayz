import { LinearGradient } from 'expo-linear-gradient'
import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'

import { Icon, type IconName } from '@/components/Icon'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { COLORS, GRADIENTS, SHADOW, TONE_HEX, type GradientName, type Tone } from '@/theme/tokens'

export interface TileItem {
  key: string
  icon: IconName
  label: string
  hint?: string
  tone?: Tone
  badge?: number
  onPress: () => void
}

/**
 * The tinted launcher grid. Four across on a phone, six on a tablet, so the tiles keep their
 * proportions instead of stretching into letterboxes on a Sunmi.
 */
export function TileGrid({ items, testID }: { items: TileItem[]; testID?: string }) {
  const { isTablet } = useDeviceClass()
  const perRow = isTablet ? 6 : 4
  const basis = `${100 / perRow}%`

  return (
    <View className="-mx-1.5 flex-row flex-wrap" testID={testID}>
      {items.map((item) => {
        const hex = TONE_HEX[item.tone ?? 'brand']
        return (
          <View key={item.key} style={{ width: basis as unknown as number }} className="px-1.5 pb-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.hint ? `${item.label}. ${item.hint}` : item.label}
              onPress={item.onPress}
              testID={`tile-${item.key}`}
              className="items-center gap-2 active:opacity-60"
            >
              <View
                className="aspect-square w-full items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${hex}14` }}
              >
                <Icon name={item.icon} size={22} color={hex} />
                {item.badge ? (
                  <View
                    className="absolute -right-1 -top-1 h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-canvas px-1"
                    style={{ backgroundColor: COLORS.danger }}
                    testID={`tile-${item.key}-badge`}
                  >
                    <Text className="text-[10px] font-extrabold text-white">{item.badge > 9 ? '9+' : item.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={2} className="text-center text-[11px] font-semibold leading-[14px] text-navy">
                {item.label}
              </Text>
            </Pressable>
          </View>
        )
      })}
    </View>
  )
}

/**
 * One of the two big figures that sit side by side under a chart — a filled card with a circular
 * badge, a quiet label and a number that carries the card.
 */
export function StatTile({
  icon,
  label,
  value,
  caption,
  gradient = 'navy',
  onPress,
  testID,
}: {
  icon: IconName
  label: string
  value: string
  caption?: string
  gradient?: GradientName
  onPress?: () => void
  testID?: string
}) {
  const body = (
    <LinearGradient
      colors={[...GRADIENTS[gradient]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ borderRadius: 26, padding: 16, minHeight: 128, justifyContent: 'space-between' }, SHADOW.card]}
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-white/20">
        <Icon name={icon} size={17} color={COLORS.white} />
      </View>
      <View className="gap-0.5">
        <Text className="text-[12px] text-white/70">{label}</Text>
        <Text
          numberOfLines={1}
          className="text-[24px] font-extrabold text-white"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {value}
        </Text>
        {caption ? (
          <Text numberOfLines={1} className="text-[11px] text-white/60">
            {caption}
          </Text>
        ) : null}
      </View>
    </LinearGradient>
  )

  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${value}`} onPress={onPress} testID={testID} className="flex-1 active:opacity-80">
        {body}
      </Pressable>
    )
  }
  return (
    <View className="flex-1" testID={testID}>
      {body}
    </View>
  )
}

/** A compact figure on a plain surface — used in rows of three under the hero. */
export function MiniStat({
  icon,
  label,
  value,
  tone = 'brand',
  onPress,
  testID,
}: {
  icon: IconName
  label: string
  value: string | number
  tone?: Tone
  onPress?: () => void
  testID?: string
}) {
  const hex = TONE_HEX[tone]
  const body = (
    <View className="flex-1 gap-2 rounded-xl2 border border-line bg-surface p-3" style={SHADOW.card}>
      <View className="h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: `${hex}1a` }}>
        <Icon name={icon} size={15} color={hex} />
      </View>
      <View>
        <Text className="text-[20px] font-extrabold text-navy" style={{ fontVariant: ['tabular-nums'] }}>
          {value}
        </Text>
        <Text numberOfLines={1} className="text-[11px] text-muted">
          {label}
        </Text>
      </View>
    </View>
  )

  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${value}`} onPress={onPress} testID={testID} className="flex-1 active:opacity-70">
        {body}
      </Pressable>
    )
  }
  return (
    <View className="flex-1" testID={testID}>
      {body}
    </View>
  )
}

/** A dark feature card — the "promo" shape from the reference, used for the next thing to do. */
export function FeatureCard({
  title,
  message,
  icon,
  action,
  gradient = 'brand',
  onPress,
  testID,
}: {
  title: string
  message: string
  icon: IconName
  action?: ReactNode
  gradient?: GradientName
  onPress?: () => void
  testID?: string
}) {
  const inner = (
    <LinearGradient
      colors={[...GRADIENTS[gradient]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ borderRadius: 26, padding: 18, overflow: 'hidden' }, SHADOW.card]}
    >
      {/* A soft disc bleeding off the corner, so the card has depth without an image. */}
      <View className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
      <View className="flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
          <Icon name={icon} size={20} color={COLORS.white} />
        </View>
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-[16px] font-extrabold text-white">{title}</Text>
          <Text className="text-[13px] leading-[18px] text-white/75">{message}</Text>
        </View>
      </View>
      {action ? <View className="mt-4">{action}</View> : null}
    </LinearGradient>
  )

  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} testID={testID} className="active:opacity-85">
        {inner}
      </Pressable>
    )
  }
  return <View testID={testID}>{inner}</View>
}
