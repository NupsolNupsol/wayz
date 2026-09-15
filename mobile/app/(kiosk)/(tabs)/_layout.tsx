import { Tabs } from 'expo-router'

import { AdaptiveTabBar } from '@/design'
import { useStationDeliveries } from '@/hooks/queries'
import { useDeviceClass } from '@/hooks/useDeviceClass'

/**
 * Five destinations for the counter.
 *
 * Sell is raised: it is what an agent taps dozens of times a shift, and it should never be more
 * than one thumb away. Records, assets, incidents and the shift live behind More rather than
 * stretching the bar past five.
 */
export default function KioskTabsLayout() {
  const { navPosition } = useDeviceClass()

  const { data: waiting } = useStationDeliveries({ status: 'RELEASE_REQUESTED' })
  const waitingCount = waiting?.length ?? 0

  return (
    <Tabs
      tabBar={(props) => <AdaptiveTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarPosition: navPosition,
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today', tabBarAccessibilityLabel: 'Home' }} />
      <Tabs.Screen name="operations" options={{ title: 'Running', tabBarAccessibilityLabel: 'Activity' }} />
      <Tabs.Screen
        name="sell"
        options={{ title: 'Sell', tabBarAccessibilityLabel: 'PlusCircle', tabBarButton: 'raised' as never }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          title: 'Deliveries',
          tabBarAccessibilityLabel: 'Truck',
          tabBarBadge: waitingCount > 0 ? waitingCount : undefined,
        }}
      />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarAccessibilityLabel: 'MoreHorizontal' }} />
    </Tabs>
  )
}
