import { useRouter } from 'expo-router'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { API_URL } from '@/api/client'
import { Button, Heading, Icon, InfoRows, Muted, ScreenHeader, toast } from '@/design'
import { useSession, useSignOut } from '@/features/auth/hooks'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { initialsOf } from '@/lib/workspace'
import { COLORS, SHADOW } from '@/theme/tokens'

export default function CourierProfileScreen() {
  const router = useRouter()
  const { me } = useSession()
  const signOut = useSignOut()
  const { isTablet } = useDeviceClass()

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['left', 'right']} testID="courier-profile">
      <ScreenHeader title="Profile" subtitle={me?.email} fallback="/(courier)/more" />

      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View className={`${isTablet ? 'px-8' : 'px-5'} gap-6 pt-5`}>
          <View className="items-center gap-3 rounded-xl3 border border-line bg-surface p-6" style={SHADOW.card}>
            <View className="h-20 w-20 items-center justify-center rounded-full bg-brand-soft">
              <Text className="text-[26px] font-extrabold text-brand-ink">{initialsOf(me)}</Text>
            </View>
            <View className="items-center">
              <Text className="text-[19px] font-extrabold text-navy">{me?.fullName ?? '—'}</Text>
              <Text className="text-[13px] text-muted">Delivery agent</Text>
            </View>
          </View>

          <View className="gap-3">
            <Heading>Account</Heading>
            <View className="rounded-xl3 border border-line bg-surface p-4" style={SHADOW.card}>
              <InfoRows
                testID="profile-account"
                rows={[
                  { label: 'Name', value: me?.fullName ?? '—' },
                  { label: 'Email', value: me?.email ?? '—' },
                  { label: 'Phone', value: me?.phone || '—' },
                  { label: 'Company', value: me?.tenant?.name ?? '—' },
                  { label: 'Site', value: me?.station?.name ?? 'All sites' },
                ]}
              />
            </View>
          </View>

          <View className="gap-3">
            <Heading>App</Heading>
            <View className="rounded-xl3 border border-line bg-surface p-4" style={SHADOW.card}>
              <InfoRows
                testID="profile-app"
                rows={[
                  { label: 'Server', value: API_URL.replace(/^https?:\/\//, '') },
                  { label: 'Workspace', value: 'Delivery' },
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
