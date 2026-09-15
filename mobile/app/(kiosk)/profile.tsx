import { useRouter } from 'expo-router'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { API_URL } from '@/api/client'
import { Button, Heading, Icon, InfoRows, Muted, ScreenHeader, toast } from '@/design'
import { ENGINE_META, enginesFor } from '@/config/engines'
import { useSession, useSignOut } from '@/features/auth/hooks'
import { useShift } from '@/hooks/queries'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { money } from '@/lib/format'
import { initialsOf } from '@/lib/workspace'
import { COLORS, SHADOW } from '@/theme/tokens'

export default function KioskProfileScreen() {
  const router = useRouter()
  const { me } = useSession()
  const signOut = useSignOut()
  const { isTablet } = useDeviceClass()
  const shift = useShift()

  const engines = enginesFor(me?.engineKinds ?? [])
  const tillOpen = shift.data?.status === 'OPEN'

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['left', 'right']} testID="kiosk-profile">
      <ScreenHeader title="Profile" subtitle="Who this device is signed in as" fallback="/(kiosk)/more" />

      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View className={`${isTablet ? 'px-8' : 'px-5'} gap-6 pt-5`}>
          <View className="items-center gap-3 rounded-xl3 border border-line bg-surface p-6" style={SHADOW.card}>
            <View className="h-20 w-20 items-center justify-center rounded-full bg-brand-soft">
              <Text className="text-[26px] font-extrabold text-brand-ink">{initialsOf(me)}</Text>
            </View>
            <View className="items-center">
              <Text className="text-[19px] font-extrabold text-navy">{me?.fullName ?? '—'}</Text>
              <Text className="text-[13px] text-muted">Kiosk agent</Text>
            </View>

            {engines.length > 0 ? (
              <View className="mt-1 flex-row flex-wrap justify-center gap-2" testID="profile-engines">
                {engines.map((kind) => (
                  <View key={kind} className="flex-row items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5">
                    <Icon name={ENGINE_META[kind].icon} size={13} color={COLORS.navy} />
                    <Text className="text-[12px] font-bold text-navy">{ENGINE_META[kind].short}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <View className="gap-3">
            <Heading>Where you work</Heading>
            <View className="rounded-xl3 border border-line bg-surface p-4" style={SHADOW.card}>
              <InfoRows
                testID="profile-posting"
                rows={[
                  { label: 'Company', value: me?.tenant?.name ?? '—' },
                  { label: 'Station', value: me?.station?.name ?? '—' },
                  { label: 'Desk', value: me?.kiosk?.name ?? 'Not tied to one desk' },
                  { label: 'Till', value: tillOpen ? `Open · ${money(shift.data?.expectedCash ?? 0)}` : 'Closed' },
                ]}
              />
            </View>
          </View>

          <View className="gap-3">
            <Heading>Account</Heading>
            <View className="rounded-xl3 border border-line bg-surface p-4" style={SHADOW.card}>
              <InfoRows
                testID="profile-account"
                rows={[
                  { label: 'Email', value: me?.email ?? '—' },
                  { label: 'Phone', value: me?.phone || '—' },
                  { label: 'Server', value: API_URL.replace(/^https?:\/\//, '') },
                ]}
              />
            </View>
            <Muted>Your password is changed on the web workspace, not here.</Muted>
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
            testID="profile-signout"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
