import { Pressable, Text, View } from 'react-native'

import { Icon, type IconName } from '@/components/Icon'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { COLORS, SHADOW, TONE_HEX, type Tone } from '@/theme/tokens'

export interface QuickAction {
  key: string
  icon: IconName
  label: string
  tone?: Tone
  badge?: number
  disabled?: boolean
  onPress: () => void
}

/**
 * The row of shortcuts that straddles the bottom of the hero. Four on a phone, six on a tablet —
 * beyond that they stop reading as a set and start reading as a menu.
 */
export function QuickActions({ actions, testID }: { actions: QuickAction[]; testID?: string }) {
  const { isTablet } = useDeviceClass()
  const shown = actions.slice(0, isTablet ? 6 : 4)

  return (
    <View
      className={`${isTablet ? 'mx-8' : 'mx-5'} -mt-8 flex-row rounded-xl3 border border-line bg-surface px-1.5 py-4`}
      style={SHADOW.pop}
      testID={testID}
    >
      {shown.map((action) => {
        const hex = TONE_HEX[action.tone ?? 'brand']
        return (
          <Pressable
            key={action.key}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityState={{ disabled: action.disabled }}
            onPress={action.disabled ? undefined : action.onPress}
            testID={`quick-${action.key}`}
            className={`flex-1 items-center gap-2 rounded-2xl py-1 active:opacity-60 ${action.disabled ? 'opacity-35' : ''}`}
          >
            <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: `${hex}1a` }}>
              <Icon name={action.icon} size={21} color={hex} />
              {action.badge ? (
                <View
                  className="absolute -right-1 -top-1 h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-surface px-1"
                  style={{ backgroundColor: COLORS.danger }}
                  testID={`quick-${action.key}-badge`}
                >
                  <Text className="text-[10px] font-extrabold text-white">
                    {action.badge > 9 ? '9+' : action.badge}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text numberOfLines={1} className="px-1 text-[11px] font-semibold text-navy">
              {action.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
