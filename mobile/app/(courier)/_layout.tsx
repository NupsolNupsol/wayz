import { Redirect, Stack } from 'expo-router'
import { View } from 'react-native'

import { Loading } from '@/design'
import { useSession } from '@/features/auth/hooks'
import { homeFor, workspaceFor } from '@/lib/workspace'
import { COLORS } from '@/theme/tokens'

/**
 * The road workspace.
 *
 * Guards the whole group: no token means the sign-in screen, and the wrong role means the app the
 * person actually works in. Everything below can therefore assume a signed-in courier.
 */
export default function CourierLayout() {
  const { me, ready, loading } = useSession()

  if (!ready || loading) {
    return (
      <View className="flex-1 bg-canvas">
        <Loading label="Opening your runs…" />
      </View>
    )
  }

  if (!me) return <Redirect href="/sign-in" />
  if (workspaceFor(me.role) !== 'courier') return <Redirect href={homeFor(me.role) as never} />

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.canvas },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
    </Stack>
  )
}
