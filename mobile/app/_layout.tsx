import '../global.css'

import { QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { queryClient } from '@/api/queryClient'
import { ToastHost } from '@/components/ui'
import { useSessionStore } from '@/store/session.store'
import { COLORS } from '@/theme/tokens'

export default function RootLayout() {
  const restore = useSessionStore((s) => s.restore)

  useEffect(() => {
    void restore()
  }, [restore])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <View className="flex-1">
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: COLORS.canvas },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
              <Stack.Screen name="(agent)" options={{ animation: 'fade' }} />
            </Stack>
            <ToastHost />
          </View>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
