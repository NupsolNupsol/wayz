// app/(agent)/till/tills.tsx
import { router } from "expo-router";
import { Pressable, View } from "react-native";

// import { AppHeader } from "@/components/AppHeader";
import { Icon, type IconName } from "@/components/Icon";
import {
  Amount,
  Body,
  Button,
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
import {
  useBookings,
  useShift,
  useStats,
  useTillOverview,
} from "@/hooks/queries";
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

export default function Till() {
  const me = useSessionStore((s) => s.me);
  const stats = useStats();
  const shift = useShift();
  const running = useBookings();
  const till = useTillOverview();

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
  const tillData = till.data;
  const tillOpen = shift.data?.status === "OPEN";

  return (
    <Screen
      scroll
      onRefresh={() => void Promise.all([stats.refetch(), till.refetch()])}
      refreshing={stats.isFetching || till.isFetching}
      testID="today"
    >
      {/* <AppHeader
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
      /> */}

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

      {/* Stats Cards */}
      <View className="mb-5 px-4">
        <View className="mb-3 flex-row gap-3">
          <Stat
            label="EXPECTED IN DRAWER"
            value={money(tillData?.drawer?.expected ?? 0)}
            icon="CircleDollarSign"
            tone={tillData?.drawer ? "info" : "neutral"}
            testID="stat-drawer"
          />
          <Stat
            label="AWAITING PAYMENT"
            value={String(tillData?.queue?.count ?? 0)}
            icon="ClipboardCheck"
            tone={tillData?.queue?.count ? "warning" : "neutral"}
            onPress={() => router.push("/till/queue")}
            testID="stat-queue"
          />
        </View>
        <View className="flex-row gap-3">
          <Stat
            label="TAKEN TODAY"
            value={money(tillData?.today?.net ?? 0)}
            icon="Banknote"
            tone="success"
            onPress={() => router.push("/till/transactions")}
            testID="stat-taken"
          />
          <Stat
            label="REFUNDED TODAY"
            value={money(tillData?.today?.refunded ?? 0)}
            icon="Undo2"
            tone={tillData?.today?.refunded > 0 ? "warning" : "neutral"}
            testID="stat-refunded"
          />
        </View>
      </View>

      {/* Cash Drawer Section */}
      <Section title="Cash Drawer" className="mb-5 px-4">
        <Card className="p-4" testID="till-drawer">
          {!tillData?.drawer ? (
            <EmptyState
              icon={<Icon name="Wallet" size={24} color={COLORS.faint} />}
              title="No open till"
              message="Open one to track cash movements."
              testID="till-no-drawer"
            />
          ) : (
            <View>
              <DrawerLine
                label="Opening float"
                value={tillData.drawer.floatIn ?? 0}
                sign="+"
                hint="Cash put in at the start"
              />
              <DrawerLine
                label="Cash taken"
                value={tillData.drawer.cashSales ?? 0}
                sign="+"
                hint="Payments in cash"
              />
              <DrawerLine
                label="Cash refunded"
                value={tillData.drawer.cashRefunds ?? 0}
                sign="−"
                hint="Given back"
              />
              <DrawerLine
                label="Paid out"
                value={tillData.drawer.paidOut ?? 0}
                sign="−"
                hint="Expenses from drawer"
              />
              <DrawerLine
                label="Banked"
                value={tillData.drawer.dropped ?? 0}
                sign="−"
                hint="Removed to safe"
              />

              <View className="border-t border-line mt-2 pt-3 flex-row items-baseline justify-between">
                <Body className="font-semibold">Should be in drawer</Body>
                <Amount
                  className="text-xl text-navy"
                  testID="till-drawer-total"
                >
                  {money(tillData.drawer.derived ?? 0)}
                </Amount>
              </View>

              {Math.abs(tillData.drawer.drift ?? 0) > 0.009 && (
                <Muted className="mt-2 text-danger">
                  This does not match the running total (
                  {money(tillData.drawer.expected ?? 0)}). Report it — do not
                  adjust your count.
                </Muted>
              )}

              <View className="mt-4 flex-row flex-wrap gap-2">
                <Pressable
                  onPress={() => router.push("/till/drawer")}
                  testID="till-go-drawer"
                  className="flex-row items-center justify-center rounded-xl2 border border-line bg-surface px-4 py-2.5"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Icon name="Banknote" size={16} color={COLORS.navy} />
                  <Body className="ml-2 text-navy">Movements</Body>
                </Pressable>
                <Pressable
                  onPress={() => router.push("/till/shift")}
                  testID="till-go-shift"
                  className="flex-row items-center justify-center rounded-xl2 border border-line bg-surface px-4 py-2.5"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Icon name="Clock" size={16} color={COLORS.navy} />
                  <Body className="ml-2 text-navy">Count & Close</Body>
                </Pressable>
              </View>
            </View>
          )}
        </Card>
      </Section>

      {/* Today at Counter Section */}
      <Section title="Today at Counter" className="mb-5 px-4">
        <Card className="p-4" testID="till-today">
          <View className="flex-row gap-3 mb-3">
            <View className="flex-1 rounded-xl border border-line bg-surface p-3">
              <View className="flex-row items-center gap-1.5">
                <Icon name="Banknote" size={13} color={COLORS.faint} />
                <Muted>Cash</Muted>
              </View>
              <Amount className="text-lg text-navy">
                {money(tillData?.today?.cash ?? 0)}
              </Amount>
            </View>
            <View className="flex-1 rounded-xl border border-line bg-surface p-3">
              <View className="flex-row items-center gap-1.5">
                <Icon name="CreditCard" size={13} color={COLORS.faint} />
                <Muted>Card</Muted>
              </View>
              <Amount className="text-lg text-navy">
                {money(tillData?.today?.card ?? 0)}
              </Amount>
            </View>
          </View>

          <View className="flex-row items-baseline justify-between py-1.5">
            <Body className="text-sm">Gross</Body>
            <Amount>{money(tillData?.today?.gross ?? 0)}</Amount>
          </View>
          <View className="flex-row items-baseline justify-between py-1.5">
            <Body className="text-sm">Less refunds</Body>
            <Amount className="text-danger">
              −{money(tillData?.today?.refunded ?? 0)}
            </Amount>
          </View>
          <View className="border-t border-line mt-2 pt-3 flex-row items-baseline justify-between">
            <Body className="font-semibold">Net</Body>
            <Amount className="text-xl text-navy" testID="till-today-net">
              {money(tillData?.today?.net ?? 0)}
            </Amount>
          </View>

          <Pressable
            onPress={() => router.push("/till/transactions")}
            testID="till-go-transactions"
            className="mt-4 flex-row items-center justify-center rounded-xl2 border border-line bg-surface py-3"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Body className="text-navy">Every transaction</Body>
            <Icon name="ChevronRight" size={15} color={COLORS.navy} />
          </Pressable>
        </Card>

        {shift.data?.status === "RECONCILING" && (
          <View className="self-start rounded-full border border-danger/30 bg-danger/10 px-3 py-1 mt-3">
            <Muted className="text-xs font-medium text-danger">
              Awaiting sign-off
            </Muted>
          </View>
        )}
      </Section>

      {/* Ending soonest Section */}
      <Section
        title="Ending soonest"
        className="px-4"
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
        <View>
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
        </View>
      }
    />
  );
}

function DrawerLine({
  label,
  value,
  sign,
  hint,
}: {
  label: string;
  value: number;
  sign?: "+" | "−";
  hint?: string;
}) {
  return (
    <View className="flex-row items-baseline justify-between gap-3 py-1.5">
      <View className="flex-1">
        <Body className="text-sm">{label}</Body>
        {hint && <Muted className="text-[11px]">{hint}</Muted>}
      </View>
      <Amount
        className={`tabular-nums font-medium ${
          sign === "−" ? "text-danger" : "text-navy"
        }`}
      >
        {sign === "−" ? "−" : sign === "+" ? "+" : ""}
        {money(value)}
      </Amount>
    </View>
  );
}

function Stat({
  label,
  value,
  icon,
  tone = "neutral",
  onPress,
  testID,
}: {
  label: string;
  value: string;
  icon: IconName;
  tone?: "neutral" | "info" | "warning" | "success" | "danger";
  onPress?: () => void;
  testID?: string;
}) {
  const color =
    tone === "info"
      ? COLORS.brand
      : tone === "warning"
      ? COLORS.warn
      : tone === "success"
      ? COLORS.success
      : tone === "danger"
      ? COLORS.danger
      : COLORS.navy;

  const body = (
    <>
      <View className="mb-2 flex-row items-center justify-between gap-2">
        <Label className="flex-1" numberOfLines={2}>
          {label}
        </Label>
        <View style={{ marginRight: 2 }}>
          <Icon name={icon} size={16} color={color} />
        </View>
      </View>
      <Amount
        className={`text-xl ${
          tone === "danger" ? "text-danger" : "text-navy"
        }`}
      >
        {value}
      </Amount>
    </>
  );

  const cls =
    "flex-1 rounded-xl2 border border-line bg-surface p-4 active:bg-canvas";

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        testID={testID}
        onPress={onPress}
        className={cls}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View
      testID={testID}
      className="flex-1 rounded-xl2 border border-line bg-surface p-4"
    >
      {body}
    </View>
  );
}