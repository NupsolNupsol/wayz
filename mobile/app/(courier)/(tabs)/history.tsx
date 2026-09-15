import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { EmptyState, Hero, Heading, Icon, Loading, MiniStat, Muted, Segmented } from '@/design'
import { useSession } from '@/features/auth/hooks'
import { useCourierBoard } from '@/features/courier/hooks'
import { deliveredToday, meta, minutesTaken } from '@/features/courier/model'
import type { Delivery } from '@/features/courier/types'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { formatDateTime } from '@/lib/format'
import { initialsOf } from '@/lib/workspace'
import { COLORS, SHADOW, TONE_HEX } from '@/theme/tokens'

type Filter = 'all' | 'DELIVERED' | 'FAILED'

/** A closed run, as a compact row — the list is read, not worked. */
function HistoryRow({ run, onPress }: { run: Delivery; onPress: () => void }) {
  const m = meta(run.status)
  const hex = TONE_HEX[m.tone]
  const mins = minutesTaken(run)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${run.customerName}, ${m.label}`}
      onPress={onPress}
      testID={`history-row-${run._id}`}
      className="flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-3 active:opacity-70"
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${hex}1a` }}>
        <Icon name={m.icon} size={17} color={hex} />
      </View>

      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-[14px] font-bold text-navy">
          {run.customerName}
        </Text>
        <Text numberOfLines={1} className="text-[12px] text-muted">
          {run.destination.address}
        </Text>
        {run.failureReason ? (
          <Text numberOfLines={1} className="mt-0.5 text-[11px] text-danger">
            {run.failureReason}
          </Text>
        ) : null}
      </View>

      <View className="items-end">
        <Text className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: hex }}>
          {m.label}
        </Text>
        <Text className="mt-0.5 text-[11px] text-faint">{formatDateTime(run.deliveredAt ?? run.updatedAt)}</Text>
        {mins !== null ? <Text className="text-[11px] text-faint">{mins} min</Text> : null}
      </View>
    </Pressable>
  )
}

export default function HistoryScreen() {
  const router = useRouter()
  const { me } = useSession()
  const { isTablet } = useDeviceClass()
  const { data, isLoading, refetch, isRefetching } = useCourierBoard()
  const [filter, setFilter] = useState<Filter>('all')

  const history = data?.history ?? []
  const delivered = history.filter((r) => r.status === 'DELIVERED')
  const failed = history.filter((r) => r.status === 'FAILED')
  const rows = filter === 'all' ? history : history.filter((r) => r.status === filter)

  const times = delivered.map(minutesTaken).filter((m): m is number => m !== null)
  const average = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['left', 'right']} testID="courier-history">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.brand} colors={[COLORS.brand]} />
        }
      >
        <Hero
          gradient="courier"
          initials={initialsOf(me)}
          name="History"
          subtitle="Runs you have closed"
          headlineLabel="Delivered today"
          headline={String(deliveredToday(history))}
          bleed={24}
          testID="history-hero"
        />

        <View className={`${isTablet ? 'px-8' : 'px-5'} -mt-4 gap-5`}>
          <View className="flex-row gap-3" style={SHADOW.card}>
            <MiniStat icon="PackageCheck" label="Delivered" value={delivered.length} tone="success" testID="history-delivered" />
            <MiniStat icon="Flag" label="Problems" value={failed.length} tone={failed.length ? 'danger' : 'neutral'} testID="history-failed" />
            <MiniStat icon="Timer" label="Avg. minutes" value={average ?? '—'} tone="brand" testID="history-average" />
          </View>

          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All', count: history.length },
              { value: 'DELIVERED', label: 'Delivered', count: delivered.length },
              { value: 'FAILED', label: 'Problems', count: failed.length },
            ]}
            testID="history-filter"
          />

          {isLoading ? (
            <Loading />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Icon name="History" size={26} color={COLORS.faint} />}
              title="Nothing here yet"
              message="Runs you deliver or report show up here, newest first."
              testID="history-empty"
            />
          ) : (
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Heading>Closed runs</Heading>
                <Muted>{rows.length}</Muted>
              </View>
              <View className="gap-2" testID="history-list">
                {rows.map((run) => (
                  <HistoryRow key={run._id} run={run} onPress={() => router.push(`/(courier)/run/${run._id}` as never)} />
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
