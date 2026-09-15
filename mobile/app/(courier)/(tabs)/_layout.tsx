import { Tabs } from 'expo-router'

import { AdaptiveTabBar } from '@/design'
import { useCourierBoard } from '@/features/courier/hooks'
import { useDeviceClass } from '@/hooks/useDeviceClass'

/**
 * Five destinations, and no more.
 *
 * Runs and Board are the two halves of the job — what I am carrying, and what is going spare.
 * Scan is raised because it is the action repeated most on a shift. History and More hold
 * everything else, grouped rather than stretched across extra tabs.
 */
export default function CourierTabsLayout() {
  const { navPosition } = useDeviceClass()
  const { data } = useCourierBoard()

  const open = data?.available.length ?? 0
  const waiting = (data?.mine ?? []).filter((r) => r.status === 'RELEASE_APPROVED').length

  return (
    <Tabs
      tabBar={(props) => <AdaptiveTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarPosition: navPosition,
      }}
    >
      <Tabs.Screen
        name="runs"
        options={{
          title: 'My runs',
          tabBarAccessibilityLabel: 'Truck',
          tabBarBadge: waiting > 0 ? waiting : undefined,
        }}
      />
      <Tabs.Screen
        name="board"
        options={{
          title: 'Board',
          tabBarAccessibilityLabel: 'Hand',
          tabBarBadge: open > 0 ? open : undefined,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{ title: 'Scan', tabBarAccessibilityLabel: 'ScanLine', tabBarButton: 'raised' as never }}
      />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarAccessibilityLabel: 'History' }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarAccessibilityLabel: 'MoreHorizontal' }} />
    </Tabs>
  )
}
