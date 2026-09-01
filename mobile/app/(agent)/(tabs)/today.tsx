import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { AppHeader } from "@/components/AppHeader";
import { Icon, type IconName } from "@/components/Icon";
import {
  Amount,
  Body,
  Card,
  EmptyState,
  Label,
  ListGroup,
  ListRow,
  Loading,
  Muted,
  Screen,
  Section,
} from "@/components/ui";
import { ENGINE_META, enginesFor } from "@/config/engines";
import { useDeviceClass } from "@/hooks/useDeviceClass";
import { useBookings, useShift, useStats } from "@/hooks/queries";
import { formatTime, humanizeMs, money } from "@/lib/format";
import { useSessionStore } from "@/store/session.store";
import { COLORS } from "@/theme/tokens";
import type { Booking } from "@/types";

const LIVE_STATUSES = [
  "ACTIVE",
  "OVERTIME",
  "RETRIEVAL_IN_PROGRESS",
  "PREPARING",
];

export default function Today() {
  const me = useSessionStore((s) => s.me);
  const { columns } = useDeviceClass();
  const stats = useStats();
  const shift = useShift();
  const running = useBookings();

  const engines = enginesFor(me?.engineKinds ?? []);
  const soonest = [...(running.data ?? [])]
    .filter((b) => LIVE_STATUSES.includes(b.status) && b.session.expectedEndAt)
    .sort(
      (a, b) =>
        new Date(a.session.expectedEndAt!).getTime() -
        new Date(b.session.expectedEndAt!).getTime(),
    )
    .slice(0, 4);

  if (stats.isLoading && !stats.data) {
    return (
      <Screen testID="today">
        <Loading label="Reading your counter…" />
      </Screen>
    );
  }

  const s = stats.data;
  const tillOpen = shift.data?.status === "OPEN";

  return (
    <Screen
      scroll
      onRefresh={() => void stats.refetch()}
      refreshing={stats.isFetching}
      testID="today"
    >
      <AppHeader
        title={`Hello, ${me?.fullName?.split(" ")[0] ?? "there"}`}
        subtitle={
          [me?.station?.name, me?.kiosk?.name].filter(Boolean).join(" · ") ||
          undefined
        }
        actions={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Profile"
            testID="today-profile"
            onPress={() => router.push("/profile")}
            className="h-10 w-10 items-center justify-center rounded-2xl border border-line bg-surface active:bg-canvas"
          >
            <Icon name="User" size={18} color={COLORS.navy} />
          </Pressable>
        }
      />

      {!tillOpen ? (
        <Card
          className="mb-4 border-warn/40 bg-warn-soft"
          onPress={() => router.push("/shift")}
          testID="today-till-closed"
        >
          <View className="flex-row items-center gap-3">
            <Icon name="Wallet" size={20} color={COLORS.warn} />
            <View className="flex-1">
              <Body className="font-semibold">Your till is closed</Body>
              <Muted>
                Open it before taking cash, or the day will not reconcile.
              </Muted>
            </View>
            <Icon name="ChevronRight" size={18} color={COLORS.warn} />
          </View>
        </Card>
      ) : null}

      <View className="mb-5 flex-row flex-wrap gap-3">
        <Stat
          label="Taken today"
          value={money(s?.todaysRevenue ?? 0)}
          icon="CircleDollarSign"
          columns={columns}
          testID="stat-revenue"
        />
        <Stat
          label="Transactions"
          value={String(s?.todaysTransactions ?? 0)}
          icon="CreditCard"
          columns={columns}
          testID="stat-transactions"
        />
        <Stat
          label="Running now"
          value={String(s?.activeOperations ?? 0)}
          icon="Activity"
          columns={columns}
          onPress={() => router.push("/operations")}
          testID="stat-active"
        />
        <Stat
          label="Overdue"
          value={String(s?.overdue ?? 0)}
          icon="Clock"
          tone={s?.overdue ? "danger" : "neutral"}
          columns={columns}
          onPress={() => router.push("/operations")}
          testID="stat-overdue"
        />
      </View>

      <Section title="Start something" className="mb-5">
        <View className="flex-row flex-wrap gap-3">
          {engines.length === 0 ? (
            <EmptyState
              title="No activities assigned"
              message="Your account is not attached to an activity yet. Ask your manager to assign one."
              testID="today-no-engines"
            />
          ) : (
            engines.map((kind) => {
              const meta = ENGINE_META[kind];
              return (
                <Pressable
                  key={kind}
                  accessibilityRole="button"
                  testID={`today-engine-${kind}`}
                  onPress={() =>
                    router.push({
                      pathname: meta.route,
                      params: { engine: kind },
                    })
                  }
                  className="min-w-[46%] flex-1 gap-2 rounded-xl2 border border-line bg-surface p-4 active:bg-canvas"
                >
                  <View className="h-11 w-11 items-center justify-center rounded-2xl bg-brand">
                    <Icon name={meta.icon} size={22} color={COLORS.white} />
                  </View>
                  <Body className="font-bold">{meta.label}</Body>
                  <Muted numberOfLines={2}>{meta.tagline}</Muted>
                </Pressable>
              );
            })
          )}
        </View>
      </Section>

      <Section
        title="Ending soonest"
        action={
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/operations")}
            testID="today-see-all"
          >
            <Muted className="font-semibold text-brand-ink">See all</Muted>
          </Pressable>
        }
      >
        {soonest.length === 0 ? (
          <EmptyState
            icon={<Icon name="Clock" size={24} color={COLORS.faint} />}
            title="Nothing running"
            message="Sessions you start appear here with their countdown."
            testID="today-nothing-running"
          />
        ) : (
          <ListGroup>
            {soonest.map((booking, index) => (
              <View key={booking.id}>
                {index > 0 ? <View className="h-px bg-line" /> : null}
                <RunningRow booking={booking} />
              </View>
            ))}
          </ListGroup>
        )}
      </Section>
    </Screen>
  );
}

function RunningRow({ booking }: { booking: Booking }) {
  const remaining = booking.session.remainingMs;
  const late =
    booking.session.isOvertime || (remaining !== null && remaining <= 0);

  return (
    <ListRow
      testID={`today-booking-${booking.id}`}
      onPress={() =>
        router.push({ pathname: "/booking/[id]", params: { id: booking.id } })
      }
      title={booking.customerName || booking.ref}
      subtitle={booking.productName}
      trailing={
        <>
          <Amount className={late ? "text-danger" : "text-navy"}>
            {remaining === null
              ? "—"
              : late
                ? "Overdue"
                : humanizeMs(remaining)}
          </Amount>
          <Muted className="text-[11px]">
            ends {formatTime(booking.session.expectedEndAt)}
          </Muted>
        </>
      }
    />
  );
}

function Stat({
  label,
  value,
  icon,
  tone = "neutral",
  columns,
  onPress,
  testID,
}: {
  label: string;
  value: string;
  icon: IconName;
  tone?: "neutral" | "danger";
  columns: number;
  onPress?: () => void;
  testID?: string;
}) {
  const basis = columns >= 4 ? "23%" : "47%";
  const body = (
    <>
      <View className="mb-2 flex-row items-center justify-between">
        <Label>{label}</Label>
        <Icon
          name={icon}
          size={16}
          color={tone === "danger" ? COLORS.danger : COLORS.faint}
        />
      </View>
      <Amount
        className={`text-2xl ${tone === "danger" ? "text-danger" : "text-navy"}`}
      >
        {value}
      </Amount>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        testID={testID}
        onPress={onPress}
        style={{ flexBasis: basis }}
        className="grow rounded-xl2 border border-line bg-surface p-4 active:bg-canvas"
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View
      style={{ flexBasis: basis }}
      className="grow rounded-xl2 border border-line bg-surface p-4"
      testID={testID}
    >
      {body}
    </View>
  );
}
