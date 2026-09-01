import { useQuery } from '@tanstack/react-query'
import { Redirect, Stack } from 'expo-router'
import { useEffect } from 'react'
import { View } from 'react-native'

import { authApi } from '@/api/endpoints'
import { Loading } from '@/components/ui'
import { useSessionStore } from '@/store/session.store'
import { COLORS } from '@/theme/tokens'

/**
 * Everything past the sign-in screen. The token proves there is a session; `me` is fetched
 * again on every launch so a role or activity change on the server reaches the device without
 * the agent having to sign out.
 */
export default function AgentLayout() {
  const ready = useSessionStore((s) => s.ready)
  const token = useSessionStore((s) => s.token)
  const me = useSessionStore((s) => s.me)
  const setMe = useSessionStore((s) => s.setMe)

  const { data, isLoading } = useQuery({ queryKey: ['me'], queryFn: authApi.me, enabled: !!token })

  useEffect(() => {
    if (data) setMe(data)
  }, [data, setMe])

  if (!ready) {
    return (
      <View className="flex-1 bg-canvas">
        <Loading />
      </View>
    )
  }

  if (!token) return <Redirect href="/sign-in" />

  if (!me && isLoading) {
    return (
      <View className="flex-1 bg-canvas">
        <Loading label="Opening your counter…" />
      </View>
    )
  }

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
