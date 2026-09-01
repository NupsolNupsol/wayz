import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'

import { Icon } from '@/components/Icon'
import { Muted, Title } from '@/components/ui'
import { COLORS } from '@/theme/tokens'

/**
 * The top of every screen: where you are, how you get back, and the one or two things you can
 * do from here. A pushed screen gets a back affordance; a tab root does not.
 */
export function AppHeader({
  title,
  subtitle,
  back = false,
  actions,
  testID,
}: {
  title: string
  subtitle?: string
  back?: boolean
  actions?: ReactNode
  testID?: string
}) {
  return (
    <View className="mb-4 gap-3" testID={testID}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          testID="header-back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
          className="h-10 w-10 items-center justify-center rounded-2xl border border-line bg-surface active:bg-canvas"
        >
          <Icon name="ArrowLeft" size={18} color={COLORS.navy} />
        </Pressable>
      ) : null}

      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-0.5">
          <Title numberOfLines={1}>{title}</Title>
          {subtitle ? <Muted numberOfLines={2}>{subtitle}</Muted> : null}
        </View>
        {actions ? <View className="flex-row items-center gap-2">{actions}</View> : null}
      </View>
    </View>
  )
}
