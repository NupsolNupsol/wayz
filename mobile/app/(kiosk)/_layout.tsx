import { Redirect, Stack } from 'expo-router'
import { View } from 'react-native'

import { Loading } from '@/design'
import { useSession } from '@/features/auth/hooks'
import { homeFor, workspaceFor } from '@/lib/workspace'
import { COLORS } from '@/theme/tokens'

/**
 * The counter workspace.
 *
 * Same guard as the road: a signed-out device goes to sign-in, and a courier who somehow lands
 * here is sent to their own app rather than shown a till they cannot open.
 */
export default function KioskLayout() {
  const { me, ready, loading } = useSession()

  if (!ready || loading) {
    return (
      <View className="flex-1 bg-canvas">
        <Loading label="Opening your counter…" />
      </View>
    )
  }

  if (!me) return <Redirect href="/sign-in" />
  if (workspaceFor(me.role) !== 'kiosk') return <Redirect href={homeFor(me.role) as never} />

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.canvas },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      <Stack.Screen name="new" options={{ presentation: 'card' }} />
    </Stack>
  )
}
