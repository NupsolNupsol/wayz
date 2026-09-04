import * as Haptics from 'expo-haptics'
import { useEffect } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { create } from 'zustand'

type ToastTone = 'success' | 'danger' | 'warn' | 'info'

interface Toast {
  id: number
  tone: ToastTone
  title: string
  detail?: string
}

interface ToastState {
  toasts: Toast[]
  push: (tone: ToastTone, title: string, detail?: string) => void
  dismiss: (id: number) => void
}

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (tone, title, detail) =>
    set((s) => ({ toasts: [...s.toasts, { id: Date.now() + Math.random(), tone, title, detail }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export function toast(tone: ToastTone, title: string, detail?: string) {
  if (Platform.OS !== 'web') {
    const style =
      tone === 'danger'
        ? Haptics.NotificationFeedbackType.Error
        : tone === 'warn'
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success
    void Haptics.notificationAsync(style)
  }
  useToastStore.getState().push(tone, title, detail)
}

const TONE: Record<ToastTone, string> = {
  success: 'bg-success',
  danger: 'bg-danger',
  warn: 'bg-warn',
  info: 'bg-navy',
}

function ToastRow({ item }: { item: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss)

  useEffect(() => {
    const ms = item.tone === 'danger' ? 6000 : 3200
    const timer = setTimeout(() => dismiss(item.id), ms)
    return () => clearTimeout(timer)
  }, [item.id, item.tone, dismiss])

  return (
    <Animated.View entering={FadeInUp.springify().damping(18)} exiting={FadeOutUp.duration(160)}>
      <Pressable
        accessibilityRole="alert"
        onPress={() => dismiss(item.id)}
        testID={`toast-${item.tone}`}
        className={`mb-2 rounded-2xl px-4 py-3 shadow-lg ${TONE[item.tone]}`}
      >
        <Text className="text-[15px] font-bold text-white">{item.title}</Text>
        {item.detail ? <Text className="mt-0.5 text-[13px] leading-5 text-white/85">{item.detail}</Text> : null}
      </Pressable>
    </Animated.View>
  )
}

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts)
  const insets = useSafeAreaInsets()

  if (!toasts.length) return null

  return (
    <View pointerEvents="box-none" className="absolute left-0 right-0 z-50" style={{ top: insets.top + 8 }}>
      <View pointerEvents="box-none" className="w-full max-w-md self-center px-4" testID="toast-host">
        {toasts.map((item) => (
          <ToastRow key={item.id} item={item} />
        ))}
      </View>
    </View>
  )
}
