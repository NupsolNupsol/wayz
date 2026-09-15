import { useRouter } from 'expo-router'
import { RefreshControl, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  BarChart,
  Button,
  Card,
  EmptyState,
  FeatureCard,
  Hero,
  Heading,
  Icon,
  Loading,
  MiniStat,
  Muted,
  QuickActions,
  StatTile,
} from '@/design'
import { useSession } from '@/features/auth/hooks'
import { RunCard } from '@/features/courier/components/RunCard'
import { useCourierBoard } from '@/features/courier/hooks'
import { deliveredToday, minutesTaken, weeklyDelivered } from '@/features/courier/model'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { firstNameOf, greeting, initialsOf } from '@/lib/workspace'
import { COLORS } from '@/theme/tokens'

/**
 * The courier's home: what I am carrying, then everything else.
 *
 * The one number in the crown is runs delivered today, because that is the number a courier is
 * measured on and the one they check between drops.
 */
export default function RunsScreen() {
  const router = useRouter()
  const { me } = useSession()
  const { isTablet } = useDeviceClass()
  const { data, isLoading, refetch, isRefetching } = useCourierBoard()

  const mine = data?.mine ?? []
  const available = data?.available ?? []
  const history = data?.history ?? []

  const carrying = mine.filter((r) => r.status === 'PICKED_UP')
  const readyToCollect = mine.filter((r) => r.status === 'RELEASE_APPROVED')
  const today = deliveredToday(history)
  const closed = history.filter((r) => r.status === 'DELIVERED')
  const times = closed.map(minutesTaken).filter((m): m is number => m !== null)
  const average = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null

  const next = readyToCollect[0] ?? carrying[0] ?? mine[0] ?? null

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['left', 'right']} testID="courier-runs">
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
          name={`${greeting()}, ${firstNameOf(me)}`}
          subtitle={me?.station?.name ?? me?.tenant?.name ?? 'Delivery agent'}
          headlineLabel="Delivered today"
          headline={String(today)}
          badgeCount={available.length}
          onPressBell={() => router.push('/(courier)/board' as never)}
          onPressAvatar={() => router.push('/(courier)/more' as never)}
          bleed={34}
          testID="courier-hero"
        />

        <QuickActions
          testID="courier-quick"
          actions={[
            { key: 'board', icon: 'Hand', label: 'Take a run', tone: 'warn', badge: available.length, onPress: () => router.push('/(courier)/board' as never) },
            { key: 'scan', icon: 'ScanLine', label: 'Scan bags', tone: 'brand', onPress: () => router.push('/(courier)/scan' as never) },
            { key: 'carrying', icon: 'Truck', label: 'Carrying', tone: 'info', badge: carrying.length, onPress: () => next && router.push(`/(courier)/run/${next._id}` as never) },
            { key: 'history', icon: 'History', label: 'History', tone: 'violet', onPress: () => router.push('/(courier)/history' as never) },
          ]}
        />

        <View className={`${isTablet ? 'px-8' : 'px-5'} mt-6 gap-6`}>
          {isLoading ? (
            <Loading label="Fetching your board…" />
          ) : (
            <>
              <View className="flex-row gap-3">
                <MiniStat icon="Truck" label="In hand" value={mine.length} tone="info" testID="stat-mine" />
                <MiniStat icon="Hand" label="On the board" value={available.length} tone="warn" testID="stat-open" />
                <MiniStat icon="Timer" label="Avg. minutes" value={average ?? '—'} tone="brand" testID="stat-average" />
              </View>

              {next ? (
                <View className="gap-3">
                  <Heading>Next up</Heading>
                  <RunCard run={next} highlight onPress={() => router.push(`/(courier)/run/${next._id}` as never)} testID="run-next" />
                </View>
              ) : (
                <FeatureCard
                  icon="Sparkles"
                  gradient="brand"
                  title="Nothing in your hands"
                  message={
                    available.length
                      ? `${available.length} run${available.length === 1 ? '' : 's'} waiting on the board. Take one to start.`
                      : 'When a desk sends bags to a gate, the run lands on your board.'
                  }
                  action={
                    available.length ? (
                      <Button
                        label="Open the board"
                        variant="secondary"
                        onPress={() => router.push('/(courier)/board' as never)}
                        testID="courier-empty-board"
                      />
                    ) : undefined
                  }
                  testID="courier-nothing"
                />
              )}

              {mine.length > 1 ? (
                <View className="gap-3">
                  <View className="flex-row items-center justify-between">
                    <Heading>Also with you</Heading>
                    <Muted>{mine.length - 1} more</Muted>
                  </View>
                  <View className="gap-3" testID="courier-mine-list">
                    {mine
                      .filter((r) => r._id !== next?._id)
                      .map((run) => (
                        <RunCard key={run._id} run={run} onPress={() => router.push(`/(courier)/run/${run._id}` as never)} />
                      ))}
                  </View>
                </View>
              ) : null}

              <View className="gap-3">
                <Heading>Your week</Heading>
                <Card testID="courier-week">
                  <BarChart data={weeklyDelivered(history)} testID="courier-chart" />
                </Card>
                <View className="flex-row gap-3">
                  <StatTile
                    icon="PackageCheck"
                    gradient="navy"
                    label="Delivered"
                    value={String(closed.length)}
                    caption="last 25 runs kept"
                    testID="courier-total-delivered"
                  />
                  <StatTile
                    icon="Flag"
                    gradient="brand"
                    label="Reported"
                    value={String(history.filter((r) => r.status === 'FAILED').length)}
                    caption="problems raised"
                    onPress={() => router.push('/(courier)/history' as never)}
                    testID="courier-total-failed"
                  />
                </View>
              </View>

              {available.length > 0 ? (
                <View className="gap-3">
                  <View className="flex-row items-center justify-between">
                    <Heading>Going spare</Heading>
                    <Muted>{available.length} open</Muted>
                  </View>
                  {available.slice(0, 2).map((run) => (
                    <RunCard key={run._id} run={run} onPress={() => router.push(`/(courier)/run/${run._id}` as never)} />
                  ))}
                  {available.length > 2 ? (
                    <Button
                      label={`See all ${available.length} on the board`}
                      variant="secondary"
                      full
                      onPress={() => router.push('/(courier)/board' as never)}
                      testID="courier-see-board"
                    />
                  ) : null}
                </View>
              ) : null}

              {mine.length === 0 && available.length === 0 && history.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={<Icon name="Truck" size={26} color={COLORS.faint} />}
                    title="No runs yet"
                    message="Your first run will appear here the moment a desk asks for a courier."
                  />
                </Card>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
