import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { Tabs } from 'expo-router'
import type { ComponentProps } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Icon, type IconName } from '@/components/Icon'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { COLORS, GRADIENTS, SHADOW } from '@/theme/tokens'

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0]

/**
 * Five slots, never more, and the middle one is raised.
 *
 * The lifted button is the action the role does most — a sale at a counter, a scan on the road —
 * so it is reachable with a thumb without hunting. On a tablet or a Sunmi the same five become a
 * left rail, because a bar pinned to the bottom of a 10" screen is a long reach from anywhere.
 *
 * A screen opts into the raised treatment with `tabBarButton: 'raised'` in its options.
 */
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
    const options = (descriptors[route.key]?.options ?? {}) as {
      title?: string
      tabBarBadge?: number | string
      tabBarAccessibilityLabel?: string
      tabBarButton?: unknown
    }
    return {
      route,
      index,
      focused: state.index === index,
      label: options.title ?? route.name,
      // The icon travels in the accessibility label slot: expo-router's typed options do not carry
      // a place for a plain string icon name, and a custom bar is free to read it from there.
      iconName: (options.tabBarAccessibilityLabel ?? 'Home') as IconName,
      badge: options.tabBarBadge,
      raised: options.tabBarButton === 'raised',
    }
  })

  if (rail) {
    return (
      <View
        className="border-e border-line bg-surface py-3"
        style={{ width: isDesk ? 208 : 92, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }}
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
            className={`mx-2 mb-1.5 flex-row items-center gap-3 rounded-2xl px-3 py-3 ${
              item.focused ? 'bg-brand-soft' : 'active:bg-canvas'
            } ${isDesk ? '' : 'justify-center'}`}
          >
            <View
              className={`h-10 w-10 items-center justify-center rounded-2xl ${item.raised && !item.focused ? 'bg-brand' : ''}`}
            >
              <Icon
                name={item.iconName}
                size={22}
                color={item.raised && !item.focused ? COLORS.white : item.focused ? COLORS.brandDark : COLORS.muted}
                strokeWidth={item.focused ? 2.4 : 2}
              />
              {item.badge ? (
                <View className="absolute -right-1 -top-1 min-w-[18px] items-center rounded-full border-2 border-surface bg-danger px-1">
                  <Text className="text-[10px] font-extrabold text-white">{item.badge}</Text>
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
      className="flex-row border-t border-line bg-surface px-1 pt-2"
      style={{ paddingBottom: Math.max(insets.bottom, 10) }}
      testID="tab-bar"
    >
      {items.map((item) =>
        item.raised ? (
          <View key={item.route.key} className="flex-1 items-center">
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: item.focused }}
              accessibilityLabel={item.label}
              testID={`tab-${item.route.name}`}
              onPress={() => press(item.index, item.route.key, item.route.name)}
              className="items-center active:opacity-80"
              style={{ marginTop: -26 }}
            >
              <LinearGradient
                colors={[...GRADIENTS.brand]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  {
                    height: 56,
                    width: 56,
                    borderRadius: 28,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 4,
                    borderColor: COLORS.surface,
                  },
                  SHADOW.float,
                ]}
              >
                <Icon name={item.iconName} size={24} color={COLORS.white} strokeWidth={2.4} />
              </LinearGradient>
              <Text numberOfLines={1} className="mt-1 text-[11px] font-bold text-brand-ink">
                {item.label}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            key={item.route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: item.focused }}
            accessibilityLabel={item.label}
            testID={`tab-${item.route.name}`}
            onPress={() => press(item.index, item.route.key, item.route.name)}
            className="flex-1 items-center gap-1 rounded-xl py-1 active:opacity-60"
          >
            <View className="h-7 items-center justify-center">
              <Icon
                name={item.iconName}
                size={22}
                color={item.focused ? COLORS.brandDark : COLORS.muted}
                strokeWidth={item.focused ? 2.4 : 2}
              />
              {item.badge ? (
                <View
                  className="absolute -right-2.5 -top-1 min-w-[18px] items-center rounded-full border-2 border-surface bg-danger px-1"
                  testID={`tab-${item.route.name}-badge`}
                >
                  <Text className="text-[10px] font-extrabold text-white">{item.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              className={`text-[11px] font-semibold ${item.focused ? 'text-brand-ink' : 'text-muted'}`}
            >
              {item.label}
            </Text>
            {item.focused ? <View className="h-1 w-5 rounded-full bg-brand" /> : <View className="h-1" />}
          </Pressable>
        ),
      )}
    </View>
  )
}
