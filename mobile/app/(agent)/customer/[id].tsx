import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { AppHeader } from "@/components/AppHeader";
import { Icon } from "@/components/Icon";
import {
  Card,
  EmptyState,
  KeyValue,
  ListGroup,
  ListRow,
  Loading,
  Ref,
  Screen,
  Section,
  StatusPill,
} from "@/components/ui";
import { useCustomer } from "@/hooks/queries";
import { engineLabel } from "@/config/engines";
import { formatDateTime } from "@/lib/format";
import { COLORS } from "@/theme/tokens";

export default function CustomerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isFetching, refetch } = useCustomer(id);

  if (isLoading) {
    return (
      <Screen testID="customer">
        <Loading />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen testID="customer">
        <AppHeader back title="Customer" />
        <EmptyState title="Customer not found" />
      </Screen>
    );
  }

  const bookings = data.bookings ?? [];

  return (
    <Screen
      scroll
      onRefresh={() => void refetch()}
      refreshing={isFetching}
      testID="customer"
    >
      <AppHeader back title={data.name} subtitle={data.phone} />

      <Card className="mb-4">
        <View className="flex-row flex-wrap gap-4">
          <KeyValue
            label="Phone"
            value={data.phone || "—"}
            className="min-w-[45%]"
          />
          <KeyValue
            label="Email"
            value={data.email || "—"}
            className="min-w-[45%]"
          />
          <KeyValue
            label="Bookings"
            value={String(bookings.length)}
            className="min-w-[45%]"
          />
        </View>
      </Card>

      <Section title="History">
        {bookings.length === 0 ? (
          <EmptyState
            icon={<Icon name="Package" size={24} color={COLORS.faint} />}
            title="No bookings yet"
            message="Their first one will appear here."
            testID="customer-no-bookings"
          />
        ) : (
          <ListGroup>
            {bookings.map((booking, index) => (
              <View key={booking.id}>
                {index > 0 ? <View className="h-px bg-line" /> : null}
                <ListRow
                  testID={`customer-booking-${booking.id}`}
                  onPress={() =>
                    router.push({
                      pathname: "/booking/[id]",
                      params: { id: booking.id },
                    })
                  }
                  title={<Ref>{booking.ref}</Ref>}
                  subtitle={`${engineLabel(booking.engineKind)} · ${formatDateTime(booking.createdAt)}`}
                  trailing={<StatusPill status={booking.status} size="sm" />}
                />
              </View>
            ))}
          </ListGroup>
        )}
      </Section>
    </Screen>
  );
}
