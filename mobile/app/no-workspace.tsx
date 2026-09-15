import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Button, Icon, InfoRows, Muted, toast } from '@/design'
import { useSession, useSignOut } from '@/features/auth/hooks'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { COLORS, GRADIENTS, SHADOW } from '@/theme/tokens'

/**
 * The backstop for a session the handhelds cannot serve.
 *
 * Sign-in refuses these roles outright, so the only way here is a session that was valid and then
 * changed — someone promoted off the counter mid-shift. Rather than a blank screen or a crash,
 * they are told plainly and given the way out.
 */
export default function NoWorkspaceScreen() {
  const router = useRouter()
  const { me } = useSession()
  const signOut = useSignOut()
  const { isTablet } = useDeviceClass()

  const role = me?.role?.replaceAll('_', ' ').toLowerCase() ?? 'this role'

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['left', 'right', 'bottom']} testID="no-workspace">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[...GRADIENTS.slate]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: 76, paddingBottom: 56, borderBottomLeftRadius: 34, borderBottomRightRadius: 34 }}
        >
          <View className="items-center gap-3 px-6">
            <View className="h-[68px] w-[68px] items-center justify-center rounded-3xl bg-white/20">
              <Icon name="Building2" size={30} color={COLORS.white} />
            </View>
            <Text className="text-[22px] font-extrabold text-white">Your work is on the web</Text>
            <Text className="text-center text-[13px] leading-[19px] text-white/75">
              The handheld apps cover the counter and the delivery board. Everything {role} does lives in the web
              workspace.
            </Text>
          </View>
        </LinearGradient>

        <View className={`w-full self-center px-5 ${isTablet ? 'max-w-lg' : ''}`}>
          <View className="-mt-8 gap-4 rounded-xl3 border border-line bg-surface p-5" style={SHADOW.pop}>
            <InfoRows
              testID="no-workspace-who"
              rows={[
                { label: 'Signed in as', value: me?.fullName ?? '—' },
                { label: 'Role', value: me?.role?.replaceAll('_', ' ') ?? '—' },
                { label: 'Company', value: me?.tenant?.name ?? '—' },
              ]}
            />

            <Button
              label="Sign out"
              full
              icon={<Icon name="LogOut" size={16} color={COLORS.white} />}
              onPress={() => {
                void signOut()
                toast('info', 'Signed out')
                router.replace('/sign-in')
              }}
              testID="no-workspace-signout"
            />
          </View>

          <Muted className="mt-5 text-center">
            If you should be working a counter, ask your manager to assign you one.
          </Muted>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
