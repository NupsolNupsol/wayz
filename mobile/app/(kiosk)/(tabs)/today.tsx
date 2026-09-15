import { useRouter } from 'expo-router'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
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
  TileGrid,
} from '@/design'
import { ENGINE_META, enginesFor } from '@/config/engines'
import { useSession } from '@/features/auth/hooks'
import { useBookings, useShift, useStationDeliveries, useStats } from '@/hooks/queries'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { formatTime, humanizeMs, money } from '@/lib/format'
import { firstNameOf, greeting, initialsOf } from '@/lib/workspace'
import { COLORS, SHADOW, toneFor, TONE_HEX } from '@/theme/tokens'
import type { Booking } from '@/types'

const LIVE_STATUSES = ['ACTIVE', 'OVERTIME', 'RETRIEVAL_IN_PROGRESS', 'PREPARING']

/** A running booking as a row: what it is, whose it is, and how long is left on it. */
function RunningRow({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  const hex = TONE_HEX[toneFor(booking.status)]
  const remaining = booking.session?.remainingMs ?? null
  const late = booking.status === 'OVERTIME' || (remaining !== null && remaining <= 0)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${booking.customerName}, ${booking.status}`}
      onPress={onPress}
      testID={`today-running-${booking._id}`}
      className="flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-3 active:opacity-70"
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${hex}1a` }}>
        <Icon name={ENGINE_META[booking.engineKind]?.icon ?? 'Package'} size={17} color={hex} />
      </View>

      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-[14px] font-bold text-navy">
          {booking.customerName}
        </Text>
        <Text numberOfLines={1} className="text-[12px] text-muted">
          {booking.productName}
        </Text>
      </View>

      <View className="items-end">
        <Text className={`text-[13px] font-extrabold ${late ? 'text-danger' : 'text-navy'}`}>
          {remaining === null ? '—' : late ? 'Overdue' : humanizeMs(remaining)}
        </Text>
        <Text className="text-[11px] text-faint">
          {booking.session?.expectedEndAt ? formatTime(booking.session.expectedEndAt) : booking.ref}
        </Text>
      </View>
    </Pressable>
  )
}

/**
 * The counter's home.
 *
 * The headline is today's takings, because that is the figure an agent is asked for. Below it: the
 * three activities they can sell, what is running now, and the money the till is holding.
 */
export default function TodayScreen() {
  const router = useRouter()
  const { me } = useSession()
  const { isTablet } = useDeviceClass()

  const stats = useStats()
  const shift = useShift()
  const running = useBookings()
  const { data: deliveries } = useStationDeliveries({ status: 'RELEASE_REQUESTED' })

  const engines = enginesFor(me?.engineKinds ?? [])
  const s = stats.data
  const tillOpen = shift.data?.status === 'OPEN'
  const waiting = deliveries?.length ?? 0

  const live = (running.data ?? []).filter((b) => LIVE_STATUSES.includes(b.status))
  const soonest = [...live]
    .filter((b) => b.session?.expectedEndAt)
    .sort((a, b) => new Date(a.session!.expectedEndAt!).getTime() - new Date(b.session!.expectedEndAt!).getTime())
    .slice(0, 4)

  const byEngine = (s?.byEngine ?? []).map((row) => ({
    label: ENGINE_META[row.engineKind]?.short ?? String(row.engineKind),
    value: row.count,
  }))

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['left', 'right']} testID="kiosk-today">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={stats.isFetching}
            onRefresh={() => void stats.refetch()}
            tintColor={COLORS.brand}
            colors={[COLORS.brand]}
          />
        }
      >
        <Hero
          gradient="kiosk"
          initials={initialsOf(me)}
          name={`${greeting()}, ${firstNameOf(me)}`}
          subtitle={[me?.station?.name, me?.kiosk?.name].filter(Boolean).join(' · ') || me?.tenant?.name}
          headlineLabel="Taken today"
          headline={money(s?.todaysRevenue ?? 0)}
          badgeCount={waiting}
          onPressBell={() => router.push('/deliveries' as never)}
          onPressAvatar={() => router.push('/(kiosk)/profile' as never)}
          bleed={34}
          testID="kiosk-hero"
        />

        <QuickActions
          testID="kiosk-quick"
          actions={[
            { key: 'sell', icon: 'PlusCircle', label: 'New sale', tone: 'brand', onPress: () => router.push('/sell' as never) },
            { key: 'running', icon: 'Activity', label: 'Running', tone: 'info', badge: live.length, onPress: () => router.push('/operations' as never) },
            { key: 'deliveries', icon: 'Truck', label: 'Deliveries', tone: 'warn', badge: waiting, onPress: () => router.push('/deliveries' as never) },
            { key: 'till', icon: 'Wallet', label: tillOpen ? 'Till' : 'Open till', tone: tillOpen ? 'success' : 'danger', onPress: () => router.push('/shift' as never) },
          ]}
        />

        <View className={`${isTablet ? 'px-8' : 'px-5'} mt-6 gap-6`}>
          {stats.isLoading && !s ? (
            <Loading label="Reading your counter…" />
          ) : (
            <>
              {!tillOpen ? (
                <FeatureCard
                  icon="Wallet"
                  gradient="slate"
                  title="Your till is closed"
                  message="No money can be taken until you open the drawer for this shift."
                  action={
                    <Button
                      label="Open the till"
                      variant="secondary"
                      onPress={() => router.push('/shift' as never)}
                      testID="today-open-till"
                    />
                  }
                  testID="today-till-closed"
                />
              ) : null}

              <View className="flex-row gap-3">
                <MiniStat icon="Receipt" label="Sales today" value={s?.todaysTransactions ?? 0} tone="brand" testID="today-sales" />
                <MiniStat icon="Activity" label="Running" value={s?.activeOperations ?? 0} tone="info" testID="today-active" />
                <MiniStat
                  icon="Timer"
                  label="Overdue"
                  value={s?.overdue ?? 0}
                  tone={(s?.overdue ?? 0) > 0 ? 'danger' : 'neutral'}
                  testID="today-overdue"
                />
              </View>

              {engines.length > 0 ? (
                <View className="gap-3">
                  <Heading>Start a sale</Heading>
                  <View className="rounded-xl3 border border-line bg-surface p-4" style={SHADOW.card}>
                    <TileGrid
                      testID="today-engines"
                      items={engines.map((kind) => ({
                        key: kind,
                        icon: ENGINE_META[kind].icon,
                        label: ENGINE_META[kind].short,
                        hint: ENGINE_META[kind].tagline,
                        tone: kind === 'SHOP_AND_DROP' ? 'brand' : kind === 'MOBILITY' ? 'info' : 'violet',
                        onPress: () => router.push(`/(kiosk)/new/${ENGINE_META[kind].flow === 'bags' ? 'shop-drop' : 'rental'}?engine=${kind}` as never),
                      }))}
                    />
                  </View>
                </View>
              ) : null}

              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Heading>Running now</Heading>
                  {live.length > 0 ? (
                    <Pressable onPress={() => router.push('/operations' as never)} testID="today-see-running">
                      <Text className="text-[13px] font-bold text-brand-ink">See all</Text>
                    </Pressable>
                  ) : null}
                </View>

                {soonest.length === 0 ? (
                  <EmptyState
                    icon={<Icon name="Activity" size={26} color={COLORS.faint} />}
                    title="Nothing running"
                    message="Sales you start show here with the time left on them."
                    testID="today-nothing-running"
                  />
                ) : (
                  <View className="gap-2" testID="today-running-list">
                    {soonest.map((booking) => (
                      <RunningRow
                        key={booking._id}
                        booking={booking}
                        onPress={() => router.push(`/(kiosk)/booking/${booking._id}` as never)}
                      />
                    ))}
                  </View>
                )}
              </View>

              <View className="gap-3">
                <Heading>The counter today</Heading>
                {byEngine.length > 0 ? (
                  <Card testID="today-chart-card">
                    <BarChart data={byEngine} testID="today-chart" />
                  </Card>
                ) : null}
                <View className="flex-row gap-3">
                  <StatTile
                    icon="Package"
                    gradient="navy"
                    label="Bags stored"
                    value={String(s?.storedBags ?? 0)}
                    caption={`${s?.pendingRetrievals ?? 0} waiting to collect`}
                    testID="today-stored"
                  />
                  <StatTile
                    icon="Wallet"
                    gradient="brand"
                    label="In the drawer"
                    value={money(shift.data?.expectedCash ?? 0)}
                    caption={tillOpen ? 'Till open' : 'Till closed'}
                    onPress={() => router.push('/shift' as never)}
                    testID="today-drawer"
                  />
                </View>
              </View>

              {(s?.openIncidents ?? 0) > 0 ? (
                <FeatureCard
                  icon="AlertTriangle"
                  gradient="slate"
                  title={`${s?.openIncidents} open incident${s?.openIncidents === 1 ? '' : 's'}`}
                  message="Flagged on the floor and still waiting to be closed."
                  action={
                    <Button
                      label="Open incidents"
                      variant="secondary"
                      onPress={() => router.push('/incidents' as never)}
                      testID="today-incidents"
                    />
                  }
                  testID="today-incident-card"
                />
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
