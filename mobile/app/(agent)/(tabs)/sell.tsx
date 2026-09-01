import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { AppHeader } from "@/components/AppHeader";
import { Icon } from "@/components/Icon";
import {
  Body,
  EmptyState,
  Muted,
  Notice,
  Screen,
  Section,
} from "@/components/ui";
import { ENGINE_META, enginesFor } from "@/config/engines";
import { useShift } from "@/hooks/queries";
import { useSessionStore } from "@/store/session.store";
import { COLORS } from "@/theme/tokens";

export default function Sell() {
  const me = useSessionStore((s) => s.me);
  const shift = useShift();
  const engines = enginesFor(me?.engineKinds ?? []);

  return (
    <Screen scroll testID="sell">
      <AppHeader
        title="New transaction"
        subtitle="Pick what the customer is here for"
      />

      {shift.data?.status !== "OPEN" ? (
        <Notice tone="warn" testID="sell-till-warning">
          <View className="flex-row items-center gap-3">
            <Icon name="Wallet" size={18} color={COLORS.warn} />
            <View className="flex-1">
              <Body className="font-semibold">Your till is not open</Body>
              <Muted>
                You can still take a card payment, but cash needs an open till.
              </Muted>
            </View>
          </View>
        </Notice>
      ) : null}

      <Section title="Activities" className="mt-4">
        {engines.length === 0 ? (
          <EmptyState
            icon={<Icon name="Boxes" size={24} color={COLORS.faint} />}
            title="No activities assigned"
            message="Your account is not attached to an activity. Ask your manager to assign one."
            testID="sell-no-engines"
          />
        ) : (
          <View className="gap-3">
            {engines.map((kind) => {
              const meta = ENGINE_META[kind];
              return (
                <Pressable
                  key={kind}
                  accessibilityRole="button"
                  testID={`sell-engine-${kind}`}
                  onPress={() =>
                    router.push({
                      pathname: meta.route,
                      params: { engine: kind },
                    })
                  }
                  className="flex-row items-center gap-4 rounded-xl2 border border-line bg-surface p-4 active:bg-canvas"
                >
                  <View className="h-14 w-14 items-center justify-center rounded-2xl bg-brand">
                    <Icon name={meta.icon} size={26} color={COLORS.white} />
                  </View>
                  <View className="min-w-0 flex-1 gap-0.5">
                    <Body className="text-base font-bold">{meta.label}</Body>
                    <Muted numberOfLines={1}>{meta.tagline}</Muted>
                  </View>
                  <Icon name="ChevronRight" size={20} color={COLORS.faint} />
                </Pressable>
              );
            })}
          </View>
        )}
      </Section>

      <Section title="Records" className="mt-6">
        <View className="gap-3">
          <Shortcut
            icon="Users"
            title="Customers"
            subtitle="Find someone, or add a new one"
            onPress={() => router.push("/customers")}
            testID="sell-customers"
          />
          <Shortcut
            icon="Package"
            title="Bookings"
            subtitle="Everything this station has taken"
            onPress={() => router.push("/bookings")}
            testID="sell-bookings"
          />
        </View>
      </Section>
    </Screen>
  );
}

function Shortcut({
  icon,
  title,
  subtitle,
  onPress,
  testID,
}: {
  icon: "Users" | "Package";
  title: string;
  subtitle: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      className="flex-row items-center gap-4 rounded-xl2 border border-line bg-surface p-4 active:bg-canvas"
    >
      <View className="h-11 w-11 items-center justify-center rounded-2xl bg-canvas">
        <Icon name={icon} size={20} color={COLORS.navy} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Body className="font-semibold">{title}</Body>
        <Muted numberOfLines={1}>{subtitle}</Muted>
      </View>
      <Icon name="ChevronRight" size={18} color={COLORS.faint} />
    </Pressable>
  );
}
