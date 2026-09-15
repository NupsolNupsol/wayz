import { useRouter } from 'expo-router'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { API_URL } from '@/api/client'
import { Button, Hero, Heading, Icon, InfoRows, Muted, TileGrid, toast } from '@/design'
import { useSession, useSignOut } from '@/features/auth/hooks'
import { useCourierBoard } from '@/features/courier/hooks'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { initialsOf } from '@/lib/workspace'
import { COLORS, SHADOW } from '@/theme/tokens'

/**
 * Everything that is not a run.
 *
 * The tab bar is capped at five, so the shortcuts that would have been tabs live here as a grid —
 * the same launcher pattern the counter app uses, so the two feel like one product.
 */
export default function MoreScreen() {
  const router = useRouter()
  const { me } = useSession()
  const signOut = useSignOut()
  const { isTablet } = useDeviceClass()
  const { data } = useCourierBoard()

  const mine = data?.mine ?? []
  const available = data?.available ?? []
  const history = data?.history ?? []

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['left', 'right']} testID="courier-more">
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <Hero
          gradient="courier"
          initials={initialsOf(me)}
          name={me?.fullName ?? 'Delivery agent'}
          subtitle={me?.email}
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
                  { key: 'runs', icon: 'Truck', label: 'My runs', tone: 'info', badge: mine.length, onPress: () => router.push('/(courier)/runs' as never) },
                  { key: 'board', icon: 'Hand', label: 'Board', tone: 'warn', badge: available.length, onPress: () => router.push('/(courier)/board' as never) },
                  { key: 'scan', icon: 'ScanLine', label: 'Scan', tone: 'brand', onPress: () => router.push('/(courier)/scan' as never) },
                  { key: 'history', icon: 'History', label: 'History', tone: 'violet', onPress: () => router.push('/(courier)/history' as never) },
                  { key: 'profile', icon: 'User', label: 'Profile', tone: 'neutral', onPress: () => router.push('/(courier)/profile' as never) },
                  { key: 'help', icon: 'LifeBuoy', label: 'How it works', tone: 'success', onPress: () => router.push('/(courier)/help' as never) },
                ]}
              />
            </View>
          </View>

          <View className="gap-3">
            <Heading>Your shift so far</Heading>
            <View className="rounded-xl3 border border-line bg-surface p-4" style={SHADOW.card} testID="more-summary">
              <InfoRows
                rows={[
                  { label: 'In your hands', value: String(mine.length) },
                  { label: 'Waiting on the board', value: String(available.length) },
                  { label: 'Closed runs kept', value: String(history.length) },
                ]}
              />
            </View>
          </View>

          <View className="gap-3">
            <Heading>This device</Heading>
            <View className="rounded-xl3 border border-line bg-surface p-4" style={SHADOW.card} testID="more-device">
              <InfoRows
                rows={[
                  { label: 'Signed in as', value: me?.fullName ?? '—' },
                  { label: 'Role', value: 'Delivery agent' },
                  { label: 'Site', value: me?.station?.name ?? me?.tenant?.name ?? '—' },
                  { label: 'Server', value: API_URL.replace(/^https?:\/\//, '') },
                ]}
              />
            </View>
            <Muted>
              Bags only. A courier never takes money — anything owed is settled at the desk that raised the run.
            </Muted>
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

          <Text className="pb-2 text-center text-[11px] text-faint">WAYZ · delivery agent</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
