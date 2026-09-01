import * as Haptics from 'expo-haptics'
import { Tabs } from 'expo-router'
import type { ComponentProps } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Icon, type IconName } from '@/components/Icon'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { COLORS } from '@/theme/tokens'

/**
 * One navigation, two shapes. On a handheld it is a bottom bar under the thumb; from a tablet
 * up it becomes a left rail, because a 1280px screen with a bottom bar wastes the width and
 * puts the controls a hand-span away from the content.
 */
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0]

export function AdaptiveTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets()
  const { navPosition, isDesk } = useDeviceClass()
  const rail = navPosition === 'left'

  const press = (index: number, routeKey: string, name: string) => {
    const focused = state.index === index
    const event = navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true })
    if (focused || event.defaultPrevented) return
    if (Platform.OS !== 'web') void Haptics.selectionAsync()
    navigation.navigate(name)
  }

  const items = state.routes.map((route, index) => {
    const options = descriptors[route.key]?.options ?? {}
    const focused = state.index === index
    const label = (options.title ?? route.name) as string
    const iconName = ((options as { tabBarIcon?: unknown }).tabBarIcon as unknown as IconName) ?? 'Home'
    const badge = options.tabBarBadge

    return { route, index, focused, label, iconName: (options.tabBarAccessibilityLabel as IconName) ?? iconName, badge }
  })

  if (rail) {
    return (
      <View
        className="border-e border-line bg-surface py-3"
        style={{ width: isDesk ? 208 : 88, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }}
        testID="tab-rail"
      >
        {items.map((item) => (
          <Pressable
            key={item.route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: item.focused }}
            accessibilityLabel={item.label}
            testID={`tab-${item.route.name}`}
            onPress={() => press(item.index, item.route.key, item.route.name)}
            className={`mx-2 mb-1 flex-row items-center gap-3 rounded-2xl px-3 py-3 ${
              item.focused ? 'bg-brand-soft' : 'active:bg-canvas'
            } ${isDesk ? '' : 'justify-center'}`}
          >
            <View>
              <Icon
                name={String(item.iconName)}
                size={22}
                color={item.focused ? COLORS.brandDark : COLORS.muted}
                strokeWidth={item.focused ? 2.4 : 2}
              />
              {item.badge ? (
                <View className="absolute -right-2 -top-1.5 min-w-[16px] items-center rounded-full bg-danger px-1">
                  <Text className="text-[10px] font-bold text-white">{item.badge}</Text>
                </View>
              ) : null}
            </View>
            {isDesk ? (
              <Text className={`text-[14px] font-semibold ${item.focused ? 'text-brand-ink' : 'text-muted'}`}>
                {item.label}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    )
  }

  return (
    <View
      className="flex-row border-t border-line bg-surface px-1 pt-1.5"
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
      testID="tab-bar"
    >
      {items.map((item) => (
        <Pressable
          key={item.route.key}
          accessibilityRole="tab"
          accessibilityState={{ selected: item.focused }}
          accessibilityLabel={item.label}
          testID={`tab-${item.route.name}`}
          onPress={() => press(item.index, item.route.key, item.route.name)}
          className="flex-1 items-center gap-1 rounded-xl py-1.5 active:bg-canvas"
        >
          <View>
            <Icon
              name={String(item.iconName)}
              size={22}
              color={item.focused ? COLORS.brandDark : COLORS.muted}
              strokeWidth={item.focused ? 2.4 : 2}
            />
            {item.badge ? (
              <View className="absolute -right-2 -top-1.5 min-w-[16px] items-center rounded-full bg-danger px-1">
                <Text className="text-[10px] font-bold text-white">{item.badge}</Text>
              </View>
            ) : null}
          </View>
          <Text
            numberOfLines={1}
            className={`text-[11px] font-semibold ${item.focused ? 'text-brand-ink' : 'text-muted'}`}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}
