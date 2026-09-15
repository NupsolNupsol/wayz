import { LinearGradient } from 'expo-linear-gradient'
import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Icon, type IconName } from '@/components/Icon'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { COLORS, GRADIENTS, type GradientName } from '@/theme/tokens'

/**
 * The coloured crown at the top of a workspace: who you are on the left, alerts on the right, and
 * the one number that matters in the middle. It is drawn taller than it looks so a card can sit
 * across its bottom edge without leaving a seam.
 */
export function Hero({
  gradient = 'courier',
  name,
  subtitle,
  initials,
  headline,
  headlineLabel,
  badgeCount = 0,
  onPressBell,
  onPressAvatar,
  right,
  children,
  bleed = 0,
  testID,
}: {
  gradient?: GradientName
  name: string
  subtitle?: string
  initials: string
  headline?: string
  headlineLabel?: string
  badgeCount?: number
  onPressBell?: () => void
  onPressAvatar?: () => void
  right?: ReactNode
  children?: ReactNode
  /** Extra height below the content, for a card that overlaps the bottom edge. */
  bleed?: number
  testID?: string
}) {
  const insets = useSafeAreaInsets()
  const { isTablet } = useDeviceClass()

  return (
    <View testID={testID}>
      <LinearGradient
        colors={[...GRADIENTS[gradient]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 24 + bleed,
          borderBottomLeftRadius: 34,
          borderBottomRightRadius: 34,
        }}
      >
        <View className={`${isTablet ? 'px-8' : 'px-5'} gap-5`}>
          <View className="flex-row items-center gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Your profile"
              onPress={onPressAvatar}
              testID="hero-avatar"
              className="h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/15 active:opacity-70"
            >
              <Text className="text-[15px] font-extrabold text-white">{initials}</Text>
            </Pressable>

            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="text-[15px] font-bold text-white">
                {name}
              </Text>
              {subtitle ? (
                <Text numberOfLines={1} className="text-[12px] text-white/70">
                  {subtitle}
                </Text>
              ) : null}
            </View>

            {right}

            {onPressBell ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={badgeCount > 0 ? `Alerts, ${badgeCount} waiting` : 'Alerts'}
                onPress={onPressBell}
                testID="hero-bell"
                className="h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/15 active:opacity-70"
              >
                <Icon name="Bell" size={18} color={COLORS.white} />
                {badgeCount > 0 ? (
                  <View
                    className="absolute -right-0.5 -top-0.5 h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-navy-deep bg-danger px-1"
                    testID="hero-bell-badge"
                  >
                    <Text className="text-[10px] font-extrabold text-white">{badgeCount > 9 ? '9+' : badgeCount}</Text>
                  </View>
                ) : null}
              </Pressable>
            ) : null}
          </View>

          {headline ? (
            <View className="items-center gap-1 pb-1">
              {headlineLabel ? <Text className="text-[13px] text-white/70">{headlineLabel}</Text> : null}
              <Text
                className={`${isTablet ? 'text-[46px]' : 'text-[38px]'} font-extrabold leading-tight text-white`}
                style={{ fontVariant: ['tabular-nums'] }}
                testID="hero-headline"
              >
                {headline}
              </Text>
            </View>
          ) : null}

          {children}
        </View>
      </LinearGradient>
    </View>
  )
}

/** A small translucent chip for the hero's top row — a shift state, a site name. */
export function HeroChip({ icon, label, testID }: { icon?: IconName; label: string; testID?: string }) {
  return (
    <View
      className="h-9 flex-row items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3"
      testID={testID}
    >
      {icon ? <Icon name={icon} size={13} color={COLORS.white} /> : null}
      <Text className="text-[12px] font-semibold text-white">{label}</Text>
    </View>
  )
}
