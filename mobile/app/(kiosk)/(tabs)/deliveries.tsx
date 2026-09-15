import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { EmptyState, Hero, Icon, Loading, Notice, Segmented, StatusPill } from '@/design'
import { useSession } from '@/features/auth/hooks'
import { useStationDeliveries } from '@/hooks/queries'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { relativeTime } from '@/lib/format'
import { initialsOf } from '@/lib/workspace'
import { COLORS, SHADOW, toneFor, TONE_HEX } from '@/theme/tokens'
import type { Delivery } from '@/types'

type Filter = 'waiting' | 'open' | 'done'

const WAITING: Delivery['status'] = 'RELEASE_REQUESTED'
const CLOSED: Delivery['status'][] = ['DELIVERED', 'CANCELLED', 'FAILED']

/**
 * A delivery as the desk sees it. The one that matters is a courier standing in front of you, so
 * that state gets a warm border and a plain instruction rather than a generic "open".
 */
function DeliveryCard({ delivery, onPress }: { delivery: Delivery; onPress: () => void }) {
  const waiting = delivery.status === WAITING
  const hex = TONE_HEX[toneFor(delivery.status)]

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${delivery.customerName}, ${delivery.status}`}
      onPress={onPress}
      testID={`delivery-${delivery._id}`}
      className={`rounded-xl3 border bg-surface p-4 active:opacity-80 ${waiting ? 'border-warn/50' : 'border-line'}`}
      style={SHADOW.card}
    >
      <View className="flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${hex}1a` }}>
          <Icon name={waiting ? 'Hand' : 'Truck'} size={19} color={hex} />
        </View>

        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            <Text numberOfLines={1} className="min-w-0 flex-1 text-[15px] font-bold text-navy">
              {delivery.customerName}
            </Text>
            <StatusPill status={delivery.status} size="sm" />
          </View>

          <View className="mt-1 flex-row items-start gap-1.5">
            <View className="pt-0.5">
              <Icon name="MapPin" size={12} color={COLORS.faint} />
            </View>
            <Text numberOfLines={2} className="min-w-0 flex-1 text-[12px] leading-4 text-muted">
              {delivery.destination.address}
            </Text>
          </View>

          <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1">
            <Text className="font-mono text-[11px] text-faint">{delivery.bookingRef}</Text>
            {delivery.assetUnitIdentifier ? (
              <Text className="font-mono text-[11px] text-muted">{delivery.assetUnitIdentifier}</Text>
            ) : null}
            <Text className="text-[11px] text-muted">{relativeTime(delivery.requestedAt)}</Text>
          </View>
        </View>
      </View>

      <View className="mt-3 flex-row items-center gap-2 rounded-2xl bg-canvas px-3 py-2">
        <Icon name="ArrowRight" size={13} color={hex} />
        <Text className="min-w-0 flex-1 text-[12px] font-semibold text-navy">
          {waiting ? 'Check the courier and release the bags' : 'Open this delivery'}
        </Text>
      </View>
    </Pressable>
  )
}

export default function DeliveriesScreen() {
  const router = useRouter()
  const { me } = useSession()
  const { isTablet } = useDeviceClass()
  const [filter, setFilter] = useState<Filter>('waiting')
  const { data = [], isLoading, isFetching, refetch } = useStationDeliveries()

  const counts = useMemo(
    () => ({
      waiting: data.filter((d) => d.status === WAITING).length,
      open: data.filter((d) => !CLOSED.includes(d.status) && d.status !== WAITING).length,
      done: data.filter((d) => CLOSED.includes(d.status)).length,
    }),
    [data],
  )

  const rows = useMemo(() => {
    const filtered = data.filter((d) => {
      if (filter === 'waiting') return d.status === WAITING
      if (filter === 'open') return !CLOSED.includes(d.status) && d.status !== WAITING
      return CLOSED.includes(d.status)
    })
    return [...filtered].sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
  }, [data, filter])

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['left', 'right']} testID="kiosk-deliveries">
      <Hero
        gradient="kiosk"
        initials={initialsOf(me)}
        name="Deliveries"
        subtitle="Bags leaving this desk with a courier"
        headlineLabel="Couriers at your desk"
        headline={String(counts.waiting)}
        bleed={26}
        testID="deliveries-hero"
      />

      <View className={`${isTablet ? 'px-8' : 'px-5'} -mt-4 gap-3 pb-3`}>
        {counts.waiting > 0 ? (
          <Notice tone="warn" testID="deliveries-waiting-banner">
            <View className="flex-row items-center gap-3">
              <Icon name="Truck" size={18} color={COLORS.warn} />
              <Text className="min-w-0 flex-1 text-[13px] font-bold text-navy">
                {counts.waiting === 1
                  ? 'A courier is waiting at your desk'
                  : `${counts.waiting} couriers are waiting at your desk`}
              </Text>
            </View>
          </Notice>
        ) : null}

        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          testID="deliveries-filter"
          options={[
            { value: 'waiting', label: 'At your desk', count: counts.waiting },
            { value: 'open', label: 'In flight', count: counts.open },
            { value: 'done', label: 'Closed', count: counts.done },
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
          contentContainerClassName={`${isTablet ? 'px-8' : 'px-5'} pb-8 gap-3`}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon={<Icon name="Truck" size={26} color={COLORS.faint} />}
              title={filter === 'waiting' ? 'Nobody waiting' : filter === 'open' ? 'Nothing in flight' : 'Nothing closed yet'}
              message={
                filter === 'waiting'
                  ? 'When a courier arrives for a run, they appear here.'
                  : 'Deliveries raised from a booking show up here.'
              }
              testID="deliveries-empty"
            />
          }
          renderItem={({ item }) => (
            <DeliveryCard
              delivery={item}
              onPress={() => router.push({ pathname: '/delivery/[id]', params: { id: item._id } })}
            />
          )}
        />
      )}
    </SafeAreaView>
  )
}
