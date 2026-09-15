import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Icon } from '@/components/Icon'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { goToTab } from '@/lib/navigation'
import { COLORS } from '@/theme/tokens'

/**
 * The plain bar for a pushed screen — a back arrow, a title, and room for one action.
 *
 * Detail screens use this rather than the hero: once you are inside something, the content is the
 * headline and a coloured crown only pushes it down the page.
 */
export function ScreenHeader({
  title,
  subtitle,
  fallback = '/',
  right,
  testID,
}: {
  title: string
  subtitle?: string
  /** Where "back" goes when the screen was opened directly, e.g. from a deep link. */
  fallback?: string
  right?: ReactNode
  testID?: string
}) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { isTablet } = useDeviceClass()

  return (
    <View
      className={`${isTablet ? 'px-8' : 'px-5'} flex-row items-center gap-3 border-b border-line bg-surface pb-3`}
      style={{ paddingTop: insets.top + 10 }}
      testID={testID}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => (router.canGoBack() ? router.back() : goToTab(fallback))}
        testID="header-back"
        className="h-10 w-10 items-center justify-center rounded-full bg-canvas active:opacity-70"
      >
        <Icon name="ArrowLeft" size={19} color={COLORS.navy} />
      </Pressable>

      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-[16px] font-extrabold text-navy">
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} className="text-[12px] text-muted">
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right}
    </View>
  )
}
