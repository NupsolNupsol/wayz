import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";

import { AppHeader } from "@/components/AppHeader";
import { Icon } from "@/components/Icon";
import {
  Amount,
  EmptyState,
  Input,
  Label,
  ListGroup,
  ListRow,
  Loading,
  Ref,
  Screen,
  Segmented,
  StatusPill,
} from "@/components/ui";
import { useUnits } from "@/hooks/queries";
import { COLORS } from "@/theme/tokens";

type Filter = "free" | "busy" | "down" | "all";

const BUSY = ["OCCUPIED", "RESERVED", "HELD", "RETRIEVAL_PENDING"];
const DOWN = [
  "OUT_OF_SERVICE",
  "MAINTENANCE",
  "BLOCKED",
  "INSPECTION_REQUIRED",
];

export default function Assets() {
  const [filter, setFilter] = useState<Filter>("free");
  const [query, setQuery] = useState("");
  const { data = [], isLoading, isFetching, refetch } = useUnits();

  const counts = useMemo(
    () => ({
      free: data.filter((u) => u.status === "AVAILABLE").length,
      busy: data.filter((u) => BUSY.includes(u.status)).length,
      down: data.filter((u) => DOWN.includes(u.status)).length,
      all: data.length,
    }),
    [data],
  );

  const rows = useMemo(() => {
    const byFilter = data.filter((u) => {
      if (filter === "free") return u.status === "AVAILABLE";
      if (filter === "busy") return BUSY.includes(u.status);
      if (filter === "down") return DOWN.includes(u.status);
      return true;
    });
    const term = query.trim().toLowerCase();
    return term
      ? byFilter.filter((u) => u.identifier.toLowerCase().includes(term))
      : byFilter;
  }, [data, filter, query]);

  return (
    <Screen padded={false} testID="assets">
      <View className="gap-3 px-4 pb-3 pt-2">
        <AppHeader
          back
          title="Assets"
          subtitle="What is free, busy or out of service"
        />

        <View className="flex-row gap-3">
          <Tile label="Free" value={counts.free} tone="success" />
          <Tile label="In use" value={counts.busy} tone="info" />
          <Tile
            label="Down"
            value={counts.down}
            tone={counts.down ? "danger" : "neutral"}
          />
        </View>

        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Find a compartment or vehicle"
          autoCapitalize="characters"
          autoCorrect={false}
          testID="assets-search"
        />

        <Segmented
          value={filter}
          onChange={setFilter}
          testID="assets-filter"
          options={[
            { value: "free", label: "Free", count: counts.free },
            { value: "busy", label: "In use", count: counts.busy },
            { value: "down", label: "Down", count: counts.down },
            { value: "all", label: "All", count: counts.all },
          ]}
        />
      </View>

      {isLoading && !data.length ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item._id}
          onRefresh={() => void refetch()}
          refreshing={isFetching}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-4 pb-6"
          ListEmptyComponent={
            <EmptyState
              icon={<Icon name="Grid3x3" size={24} color={COLORS.faint} />}
              title="Nothing here"
              message="Units provisioned for this station appear here."
              testID="assets-empty"
            />
          }
          renderItem={({ item, index }) => (
            <ListGroup className={index === 0 ? "" : "mt-2"}>
              <ListRow
                chevron={false}
                testID={`asset-${item._id}`}
                title={<Ref>{item.identifier}</Ref>}
                subtitle={
                  item.currentBookingId ? "Holding a booking" : undefined
                }
                trailing={<StatusPill status={item.status} size="sm" />}
              />
            </ListGroup>
          )}
        />
      )}
    </Screen>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "info" | "danger" | "neutral";
}) {
  const colour = {
    success: "text-success",
    info: "text-info",
    danger: "text-danger",
    neutral: "text-navy",
  }[tone];
  return (
    <View className="flex-1 rounded-xl2 border border-line bg-surface p-3">
      <Label>{label}</Label>
      <Amount className={`text-xl ${colour}`}>{value}</Amount>
    </View>
  );
}
