import { useRouter } from 'expo-router'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { API_URL } from '@/api/client'
import { Button, FeatureCard, Hero, Heading, Icon, InfoRows, Muted, TileGrid, toast } from '@/design'
import { ENGINE_META, enginesFor } from '@/config/engines'
import { useSession, useSignOut } from '@/features/auth/hooks'
import { useIncidents, useShift, useStats } from '@/hooks/queries'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { money } from '@/lib/format'
import { initialsOf } from '@/lib/workspace'
import { COLORS, SHADOW } from '@/theme/tokens'

/**
 * Everything the five tabs could not hold, as one launcher.
 *
 * Grouping these instead of adding tabs keeps the bar readable, and puts the rarely-used screens
 * exactly one predictable tap away.
 */
export default function KioskMoreScreen() {
  const router = useRouter()
  const { me } = useSession()
  const signOut = useSignOut()
  const { isTablet } = useDeviceClass()

  const shift = useShift()
  const incidents = useIncidents()
  const stats = useStats()

  const openIncidents = (incidents.data ?? []).filter((i) => i.status !== 'RESOLVED' && i.status !== 'REJECTED').length
  const tillOpen = shift.data?.status === 'OPEN'
  const engines = enginesFor(me?.engineKinds ?? [])

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['left', 'right']} testID="kiosk-more">
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <Hero
          gradient="kiosk"
          initials={initialsOf(me)}
          name={me?.fullName ?? 'Kiosk agent'}
          subtitle={[me?.station?.name, me?.kiosk?.name].filter(Boolean).join(' · ') || me?.email}
          bleed={20}
          testID="more-hero"
        />

        <View className={`${isTablet ? 'px-8' : 'px-5'} -mt-3 gap-6`}>
          <View className="gap-3">
            <Heading>Go to</Heading>
            <View className="rounded-xl3 border border-line bg-surface p-4" style={SHADOW.card}>
              <TileGrid
                testID="more-tiles"
                items={[
                  { key: 'shift', icon: 'Wallet', label: 'Till & cash', tone: tillOpen ? 'success' : 'danger', onPress: () => router.push('/shift' as never) },
                  { key: 'bookings', icon: 'ClipboardList', label: 'Bookings', tone: 'info', onPress: () => router.push('/bookings' as never) },
                  { key: 'customers', icon: 'Users', label: 'Customers', tone: 'brand', onPress: () => router.push('/customers' as never) },
                  { key: 'assets', icon: 'Grid3x3', label: 'Assets', tone: 'violet', onPress: () => router.push('/assets' as never) },
                  { key: 'incidents', icon: 'AlertTriangle', label: 'Incidents', tone: 'warn', badge: openIncidents, onPress: () => router.push('/incidents' as never) },
                  { key: 'profile', icon: 'User', label: 'Profile', tone: 'neutral', onPress: () => router.push('/(kiosk)/profile' as never) },
                ]}
              />
            </View>
          </View>

          {!tillOpen ? (
            <FeatureCard
              icon="Wallet"
              gradient="slate"
              title="Till is closed"
              message="Open the drawer before you take any money at this counter."
              action={
                <Button label="Open the till" variant="secondary" onPress={() => router.push('/shift' as never)} testID="more-open-till" />
              }
              testID="more-till-card"
            />
          ) : null}

          <View className="gap-3">
            <Heading>This counter</Heading>
            <View className="rounded-xl3 border border-line bg-surface p-4" style={SHADOW.card} testID="more-counter">
              <InfoRows
                rows={[
                  { label: 'Till', value: tillOpen ? `Open · ${money(shift.data?.expectedCash ?? 0)}` : 'Closed' },
                  { label: 'Sales today', value: String(stats.data?.todaysTransactions ?? 0) },
                  { label: 'Running now', value: String(stats.data?.activeOperations ?? 0) },
                  { label: 'Open incidents', value: String(openIncidents) },
                ]}
              />
            </View>
          </View>

          <View className="gap-3">
            <Heading>You can sell</Heading>
            <View className="flex-row flex-wrap gap-2" testID="more-engines">
              {engines.length === 0 ? (
                <Muted>No activity is assigned to you yet.</Muted>
              ) : (
                engines.map((kind) => (
                  <View key={kind} className="flex-row items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5">
                    <Icon name={ENGINE_META[kind].icon} size={13} color={COLORS.brandDark} />
                    <Text className="text-[12px] font-bold text-brand-ink">{ENGINE_META[kind].label}</Text>
                  </View>
                ))
              )}
            </View>
          </View>

          <View className="gap-3">
            <Heading>This device</Heading>
            <View className="rounded-xl3 border border-line bg-surface p-4" style={SHADOW.card} testID="more-device">
              <InfoRows
                rows={[
                  { label: 'Signed in as', value: me?.fullName ?? '—' },
                  { label: 'Role', value: 'Kiosk agent' },
                  { label: 'Server', value: API_URL.replace(/^https?:\/\//, '') },
                ]}
              />
            </View>
          </View>

          <Button
            label="Sign out"
            variant="secondary"
            full
            icon={<Icon name="LogOut" size={16} color={COLORS.danger} />}
            onPress={() => {
              void signOut()
              toast('info', 'Signed out')
              router.replace('/sign-in')
            }}
            testID="more-signout"
          />

          <Text className="pb-2 text-center text-[11px] text-faint">WAYZ · {me?.tenant?.name ?? 'kiosk agent'}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
