import type { ReactNode } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useDeviceClass } from '@/hooks/useDeviceClass'
import { COLORS } from '@/theme/tokens'

/**
 * Every screen sits inside this: safe areas honoured, one page background, and content that
 * stops widening once the screen is wider than a line of text should be.
 */
export function Screen({
  children,
  scroll = false,
  padded = true,
  onRefresh,
  refreshing = false,
  edges = ['top', 'left', 'right'],
  footer,
  testID,
}: {
  children: ReactNode
  scroll?: boolean
  padded?: boolean
  onRefresh?: () => void
  refreshing?: boolean
  edges?: ('top' | 'bottom' | 'left' | 'right')[]
  /** Pinned under the content — where a wizard's primary action lives. */
  footer?: ReactNode
  testID?: string
}) {
  const { contentMaxWidth } = useDeviceClass()

  const body = (
    <View
      className={`w-full flex-1 self-center ${padded ? 'px-4 pb-4 pt-2' : ''}`}
      style={contentMaxWidth ? { maxWidth: contentMaxWidth } : undefined}
    >
      {children}
    </View>
  )

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={edges} testID={testID}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brand} colors={[COLORS.brand]} />
            ) : undefined
          }
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}

      {footer ? (
        <View
          className="w-full self-center border-t border-line bg-surface px-4 pb-4 pt-3"
          style={contentMaxWidth ? { maxWidth: contentMaxWidth } : undefined}
        >
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  )
}
