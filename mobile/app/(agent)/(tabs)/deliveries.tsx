import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";

import { AppHeader } from "@/components/AppHeader";
import { Icon } from "@/components/Icon";
import {
  Body,
  EmptyState,
  Loading,
  Muted,
  Notice,
  Ref,
  Screen,
  Segmented,
  StatusPill,
} from "@/components/ui";
import { useStationDeliveries } from "@/hooks/queries";
import { relativeTime } from "@/lib/format";
import { COLORS } from "@/theme/tokens";
import type { Delivery } from "@/types";

type Filter = "waiting" | "open" | "done";

const WAITING: Delivery["status"] = "RELEASE_REQUESTED";
const CLOSED: Delivery["status"][] = ["DELIVERED", "CANCELLED", "FAILED"];

export default function Deliveries() {
  const [filter, setFilter] = useState<Filter>("waiting");
  const { data = [], isLoading, isFetching, refetch } = useStationDeliveries();

  const counts = useMemo(
    () => ({
      waiting: data.filter((d) => d.status === WAITING).length,
      open: data.filter(
        (d) => !CLOSED.includes(d.status) && d.status !== WAITING,
      ).length,
      done: data.filter((d) => CLOSED.includes(d.status)).length,
    }),
    [data],
  );

  const rows = useMemo(() => {
    const filtered = data.filter((d) => {
      if (filter === "waiting") return d.status === WAITING;
      if (filter === "open")
        return !CLOSED.includes(d.status) && d.status !== WAITING;
      return CLOSED.includes(d.status);
    });
    return [...filtered].sort(
      (a, b) =>
        new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime(),
    );
  }, [data, filter]);

  if (isLoading && !data.length) {
    return (
      <Screen testID="deliveries">
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen padded={false} testID="deliveries">
      <View className="gap-3 px-4 pb-3 pt-2">
        <AppHeader
          title="Deliveries"
          subtitle="Bags leaving this desk with a courier"
        />

        {counts.waiting > 0 ? (
          <Notice tone="warn" testID="deliveries-waiting-banner">
            <View className="flex-row items-center gap-3">
              <Icon name="Truck" size={18} color={COLORS.warn} />
              <Body className="flex-1 font-semibold">
                {counts.waiting === 1
                  ? "A courier is waiting at your desk"
                  : `${counts.waiting} couriers are waiting at your desk`}
              </Body>
            </View>
          </Notice>
        ) : null}

        <Segmented
          value={filter}
          onChange={setFilter}
          testID="deliveries-filter"
          options={[
            { value: "waiting", label: "At your desk", count: counts.waiting },
            { value: "open", label: "In flight", count: counts.open },
            { value: "done", label: "Closed", count: counts.done },
          ]}
        />
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item._id}
        onRefresh={() => void refetch()}
        refreshing={isFetching}
        contentContainerClassName="px-4 pb-6 gap-2"
        ListEmptyComponent={
          <EmptyState
            icon={<Icon name="Truck" size={24} color={COLORS.faint} />}
            title={
              filter === "waiting"
                ? "Nobody waiting"
                : filter === "open"
                  ? "Nothing in flight"
                  : "Nothing closed yet"
            }
            message={
              filter === "waiting"
                ? "When a courier arrives for a job, they appear here."
                : "Deliveries raised from a booking show up here."
            }
            testID="deliveries-empty"
          />
        }
        renderItem={({ item }) => <DeliveryCard delivery={item} />}
      />
    </Screen>
  );
}

function DeliveryCard({ delivery }: { delivery: Delivery }) {
  const waiting = delivery.status === WAITING;

  return (
    <View
      className={`rounded-xl2 border bg-surface p-4 ${waiting ? "border-warn/50" : "border-line"}`}
      testID={`delivery-${delivery._id}`}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            <Ref>{delivery.bookingRef}</Ref>
            <StatusPill status={delivery.status} size="sm" />
          </View>
          <Body className="font-semibold" numberOfLines={1}>
            {delivery.customerName}
          </Body>
          <View className="flex-row items-start gap-1.5">
            <Icon name="MapPin" size={13} color={COLORS.faint} />
            <Muted className="flex-1" numberOfLines={2}>
              {delivery.destination.address}
            </Muted>
          </View>
        </View>

        <View className="items-end gap-1">
          <Muted className="text-[11px]">
            {relativeTime(delivery.requestedAt)}
          </Muted>
          {delivery.assetUnitIdentifier ? (
            <Ref className="text-[13px]">{delivery.assetUnitIdentifier}</Ref>
          ) : null}
        </View>
      </View>

      <View className="mt-3">
        <Body
          className="font-semibold text-brand-ink"
          onPress={() =>
            router.push({
              pathname: "/delivery/[id]",
              params: { id: delivery._id },
            })
          }
          testID={`delivery-open-${delivery._id}`}
        >
          {waiting ? "Check the courier & release →" : "Open →"}
        </Body>
      </View>
    </View>
  );
}
