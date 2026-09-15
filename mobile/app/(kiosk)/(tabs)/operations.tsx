import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { EmptyState, Hero, Icon, Input, Loading, Segmented, StatusPill } from '@/design'
import { ENGINE_META, engineLabel } from '@/config/engines'
import { useSession } from '@/features/auth/hooks'
import { useBookings } from '@/hooks/queries'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { formatTime, humanizeMs } from '@/lib/format'
import { initialsOf } from '@/lib/workspace'
import { COLORS, SHADOW, toneFor, TONE_HEX } from '@/theme/tokens'
import type { Booking } from '@/types'

type Filter = 'running' | 'late' | 'retrieval' | 'all'

const LIVE_STATUSES = ['ACTIVE', 'OVERTIME', 'RESERVED', 'CONFIRMED', 'RETRIEVAL_IN_PROGRESS', 'PREPARING']

/**
 * One live session. The clock is the loudest thing on the card, because everything an agent does
 * on this screen is decided by how much time is left.
 */
function OperationCard({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  const remaining = booking.session?.remainingMs ?? null
  const late = booking.session?.isOvertime || booking.status === 'OVERTIME'
  const soon = !late && remaining !== null && remaining < 15 * 60_000
  const hex = TONE_HEX[toneFor(booking.status)]

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${booking.customerName || 'Walk-in'}, ${booking.status}`}
      onPress={onPress}
      testID={`operation-${booking.id}`}
      className={`rounded-xl3 border bg-surface p-4 active:opacity-80 ${
        late ? 'border-danger/40' : soon ? 'border-warn/40' : 'border-line'
      }`}
      style={SHADOW.card}
    >
      <View className="flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${hex}1a` }}>
          <Icon name={ENGINE_META[booking.engineKind]?.icon ?? 'Package'} size={19} color={hex} />
        </View>

        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            <Text numberOfLines={1} className="min-w-0 flex-1 text-[15px] font-bold text-navy">
              {booking.customerName || 'Walk-in'}
            </Text>
            <StatusPill status={booking.status} size="sm" />
          </View>
          <Text numberOfLines={1} className="mt-0.5 text-[12px] text-muted">
            {engineLabel(booking.engineKind)} · {booking.productName}
          </Text>
          <View className="mt-1.5 flex-row items-center gap-3">
            <Text className="font-mono text-[11px] text-faint">{booking.ref}</Text>
            {booking.bags?.length ? (
              <View className="flex-row items-center gap-1">
                <Icon name="Package" size={11} color={COLORS.faint} />
                <Text className="text-[11px] text-muted">{booking.bags.length} bags</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View className="items-end">
          <Text
            className={`text-[15px] font-extrabold ${late ? 'text-danger' : soon ? 'text-warn' : 'text-navy'}`}
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {remaining === null ? '—' : late ? 'Overdue' : humanizeMs(remaining)}
          </Text>
          <Text className="mt-0.5 text-[11px] text-faint">
            {booking.session?.expectedEndAt ? `ends ${formatTime(booking.session.expectedEndAt)}` : ''}
          </Text>
        </View>
      </View>
    </Pressable>
  )
}

export default function OperationsScreen() {
  const router = useRouter()
  const { me } = useSession()
  const { isTablet } = useDeviceClass()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const { data = [], isLoading, isFetching, refetch } = useBookings()

  const live = useMemo(() => data.filter((b) => LIVE_STATUSES.includes(b.status)), [data])

  const counts = useMemo(
    () => ({
      running: live.filter((b) => b.status === 'ACTIVE').length,
      late: live.filter((b) => b.status === 'OVERTIME' || b.session?.isOvertime).length,
      retrieval: live.filter((b) => b.status === 'RETRIEVAL_IN_PROGRESS').length,
      all: live.length,
    }),
    [live],
  )

  const rows = useMemo(() => {
    const byFilter = live.filter((b) => {
      if (filter === 'running') return b.status === 'ACTIVE'
      if (filter === 'late') return b.status === 'OVERTIME' || b.session?.isOvertime
      if (filter === 'retrieval') return b.status === 'RETRIEVAL_IN_PROGRESS'
      return true
    })

    const term = query.trim().toLowerCase()
    const searched = term
      ? byFilter.filter((b) =>
          [b.ref, b.customerName, b.customerPhone, b.productName].filter(Boolean).join(' ').toLowerCase().includes(term),
        )
      : byFilter

    return [...searched].sort((a, b) => (a.session?.remainingMs ?? Infinity) - (b.session?.remainingMs ?? Infinity))
  }, [live, filter, query])

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['left', 'right']} testID="kiosk-operations">
      <Hero
        gradient="kiosk"
        initials={initialsOf(me)}
        name="Running now"
        subtitle="Every live session at this counter"
        headlineLabel="Live sessions"
        headline={String(counts.all)}
        bleed={26}
        testID="operations-hero"
      />

      <View className={`${isTablet ? 'px-8' : 'px-5'} -mt-4 gap-3 pb-3`}>
        <View className="rounded-2xl bg-surface" style={SHADOW.pop}>
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Search a reference, a name, a phone…"
            autoCapitalize="none"
            autoCorrect={false}
            testID="operations-search"
          />
        </View>

        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          testID="operations-filter"
          options={[
            { value: 'running', label: 'Running', count: counts.running },
            { value: 'late', label: 'Late', count: counts.late },
            { value: 'retrieval', label: 'Return', count: counts.retrieval },
            { value: 'all', label: 'All', count: counts.all },
          ]}
        />
      </View>

      {isLoading && !data.length ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          onRefresh={() => void refetch()}
          refreshing={isFetching}
          contentContainerClassName={`${isTablet ? 'px-8' : 'px-5'} pb-8 gap-3`}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon={<Icon name="Activity" size={26} color={COLORS.faint} />}
              title={query ? 'Nothing matches' : 'Nothing running'}
              message={query ? 'Try a shorter search.' : 'Sessions appear here as soon as they start.'}
              testID="operations-empty"
            />
          }
          renderItem={({ item }) => (
            <OperationCard
              booking={item}
              onPress={() => router.push({ pathname: '/booking/[id]', params: { id: item.id } })}
            />
          )}
        />
      )}
    </SafeAreaView>
  )
}
