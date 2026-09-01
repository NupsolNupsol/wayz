import { Tabs } from "expo-router";

import { AdaptiveTabBar } from "@/components/AdaptiveTabBar";
import { useStationDeliveries } from "@/hooks/queries";
import { useDeviceClass } from "@/hooks/useDeviceClass";

export default function TabsLayout() {
  const { navPosition } = useDeviceClass();

  const { data: waiting } = useStationDeliveries({
    status: "RELEASE_REQUESTED",
  });
  const waitingCount = waiting?.length ?? 0;

  return (
    <Tabs
      tabBar={(props) => <AdaptiveTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "transparent" },
        tabBarPosition: navPosition,
      }}
    >
      <Tabs.Screen
        name="today"
        options={{ title: "Today", tabBarAccessibilityLabel: "Home" }}
      />
      <Tabs.Screen
        name="operations"
        options={{ title: "Running", tabBarAccessibilityLabel: "Activity" }}
      />
      <Tabs.Screen
        name="sell"
        options={{ title: "New", tabBarAccessibilityLabel: "PlusCircle" }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          title: "Deliveries",
          tabBarAccessibilityLabel: "Truck",
          tabBarBadge: waitingCount > 0 ? waitingCount : undefined,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: "More", tabBarAccessibilityLabel: "MoreHorizontal" }}
      />
    </Tabs>
  );
}
