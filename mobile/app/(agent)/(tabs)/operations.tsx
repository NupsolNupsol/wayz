import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";

import { AppHeader } from "@/components/AppHeader";
import { Icon } from "@/components/Icon";
import {
  Amount,
  Body,
  EmptyState,
  Input,
  Loading,
  Muted,
  Ref,
  Screen,
  Segmented,
  StatusPill,
} from "@/components/ui";
import { engineLabel } from "@/config/engines";
import { useBookings } from "@/hooks/queries";
import { formatTime, humanizeMs } from "@/lib/format";
import { COLORS } from "@/theme/tokens";
import type { Booking } from "@/types";

type Filter = "running" | "late" | "retrieval" | "all";

export default function Operations() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const { data = [], isLoading, isFetching, refetch } = useBookings();

  const live = useMemo(
    () =>
      data.filter((b) =>
        [
          "ACTIVE",
          "OVERTIME",
          "RESERVED",
          "CONFIRMED",
          "RETRIEVAL_IN_PROGRESS",
          "PREPARING",
        ].includes(b.status),
      ),
    [data],
  );

  const counts = useMemo(
    () => ({
      running: live.filter((b) => b.status === "ACTIVE").length,
      late: live.filter((b) => b.status === "OVERTIME" || b.session.isOvertime)
        .length,
      retrieval: live.filter((b) => b.status === "RETRIEVAL_IN_PROGRESS")
        .length,
      all: live.length,
    }),
    [live],
  );

  const rows = useMemo(() => {
    const byFilter = live.filter((b) => {
      if (filter === "running") return b.status === "ACTIVE";
      if (filter === "late")
        return b.status === "OVERTIME" || b.session.isOvertime;
      if (filter === "retrieval") return b.status === "RETRIEVAL_IN_PROGRESS";
      return true;
    });

    const term = query.trim().toLowerCase();
    const searched = term
      ? byFilter.filter((b) =>
          [b.ref, b.customerName, b.customerPhone, b.productName]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(term),
        )
      : byFilter;

    return [...searched].sort(
      (a, b) =>
        (a.session.remainingMs ?? Infinity) -
        (b.session.remainingMs ?? Infinity),
    );
  }, [live, filter, query]);

  if (isLoading && !data.length) {
    return (
      <Screen testID="operations">
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen padded={false} testID="operations">
      <View className="gap-3 px-4 pb-3 pt-2">
        <AppHeader
          title="Running"
          subtitle="Every live session at this counter"
        />

        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search a reference, a name, a phone…"
          autoCapitalize="none"
          autoCorrect={false}
          testID="operations-search"
        />

        <Segmented
          value={filter}
          onChange={setFilter}
          testID="operations-filter"
          options={[
            { value: "running", label: "Running", count: counts.running },
            { value: "late", label: "Late", count: counts.late },
            { value: "retrieval", label: "Return", count: counts.retrieval },
            { value: "all", label: "All", count: counts.all },
          ]}
        />
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        onRefresh={() => void refetch()}
        refreshing={isFetching}
        contentContainerClassName="px-4 pb-6 gap-2"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EmptyState
            icon={<Icon name="Activity" size={24} color={COLORS.faint} />}
            title={query ? "Nothing matches" : "Nothing here"}
            message={
              query
                ? "Try a shorter search."
                : "Sessions appear here as soon as they start."
            }
            testID="operations-empty"
          />
        }
        renderItem={({ item }) => <OperationCard booking={item} />}
      />
    </Screen>
  );
}

function OperationCard({ booking }: { booking: Booking }) {
  const remaining = booking.session.remainingMs;
  const late = booking.session.isOvertime || booking.status === "OVERTIME";
  const soon = !late && remaining !== null && remaining < 15 * 60_000;

  return (
    <View
      className={`rounded-xl2 border bg-surface p-4 ${late ? "border-danger/40" : soon ? "border-warn/40" : "border-line"}`}
      testID={`operation-${booking.id}`}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            <Ref>{booking.ref}</Ref>
            <StatusPill status={booking.status} size="sm" />
          </View>
          <Body className="font-semibold" numberOfLines={1}>
            {booking.customerName || "Walk-in"}
          </Body>
          <Muted numberOfLines={1}>
            {engineLabel(booking.engineKind)} · {booking.productName}
          </Muted>
        </View>

        <View className="items-end gap-0.5">
          <Amount
            className={late ? "text-danger" : soon ? "text-warn" : "text-navy"}
          >
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
      </View>

      <View className="mt-3 flex-row gap-2">
        <ActionLink
          label="Open"
          onPress={() =>
            router.push({
              pathname: "/booking/[id]",
              params: { id: booking.id },
            })
          }
          testID={`operation-open-${booking.id}`}
        />
        {booking.bags.length > 0 ? (
          <Muted className="self-center">{booking.bags.length} bags</Muted>
        ) : null}
      </View>
    </View>
  );
}

function ActionLink({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <View className="flex-row">
      <Body
        className="font-semibold text-brand-ink"
        onPress={onPress}
        testID={testID}
      >
        {label} →
      </Body>
    </View>
  );
}
