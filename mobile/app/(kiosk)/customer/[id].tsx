import { router, useLocalSearchParams } from 'expo-router'
import { View } from 'react-native'

import {
  Card,
  EmptyState,
  Icon,
  KeyValue,
  ListGroup,
  ListRow,
  Loading,
  Ref,
  Screen,
  ScreenHeader,
  Section,
  StatusPill,
} from '@/design'
import { engineLabel } from '@/config/engines'
import { useCustomer } from '@/hooks/queries'
import { formatDateTime } from '@/lib/format'
import { KIOSK_TABS } from '@/lib/navigation'
import { COLORS } from '@/theme/tokens'

/** One customer: how to reach them, and everything they have ever rented from us. */
export default function CustomerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, isLoading, isFetching, refetch } = useCustomer(id)

  const header = (
    <ScreenHeader title={data?.name ?? 'Customer'} subtitle={data?.phone} fallback={KIOSK_TABS.more} />
  )

  if (isLoading) {
    return (
      <Screen testID="customer" header={header}>
        <Loading />
      </Screen>
    )
  }

  if (!data) {
    return (
      <Screen testID="customer" header={header}>
        <EmptyState title="Customer not found" message="They may belong to another station." />
      </Screen>
    )
  }

  const bookings = data.bookings ?? []

  return (
    <Screen scroll onRefresh={() => void refetch()} refreshing={isFetching} testID="customer" header={header}>
      <Card className="mb-4">
        <View className="flex-row flex-wrap gap-4">
          <KeyValue label="Phone" value={data.phone || '—'} className="min-w-[45%]" />
          <KeyValue label="Email" value={data.email || '—'} className="min-w-[45%]" />
          <KeyValue label="Bookings" value={String(bookings.length)} className="min-w-[45%]" />
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
                  onPress={() => router.push({ pathname: '/booking/[id]', params: { id: booking.id } })}
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
  )
}
