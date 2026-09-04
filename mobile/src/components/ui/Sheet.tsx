import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useDeviceClass } from '@/hooks/useDeviceClass'
import { Heading, Muted } from './Text'

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  testID,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  testID?: string
}) {
  const insets = useSafeAreaInsets()
  const { isTablet } = useDeviceClass()

  return (
    <Modal visible={open} transparent animationType={isTablet ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View className={`flex-1 bg-black/40 ${isTablet ? 'items-center justify-center p-6' : 'justify-end'}`}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          className="absolute inset-0"
          onPress={onClose}
          testID={testID ? `${testID}-backdrop` : undefined}
        />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className={isTablet ? 'w-full max-w-xl' : ''}>
          <View
            testID={testID}
            className={`bg-surface ${isTablet ? 'rounded-xl2 border border-line' : 'rounded-t-3xl'}`}
            style={{ maxHeight: '88%', paddingBottom: isTablet ? 0 : insets.bottom }}
          >
            {!isTablet ? <View className="mx-auto mt-3 h-1 w-10 rounded-full bg-line" /> : null}

            <View className="gap-1 px-5 pb-3 pt-4">
              <Heading>{title}</Heading>
              {subtitle ? <Muted>{subtitle}</Muted> : null}
            </View>

            <ScrollView className="px-5" keyboardShouldPersistTaps="handled" contentContainerClassName="pb-4 gap-4">
              {children}
            </ScrollView>

            {footer ? <View className="gap-2 border-t border-line px-5 py-3">{footer}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}
