import * as Haptics from 'expo-haptics'
import type { ReactNode } from 'react'
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native'

import { COLORS } from '@/theme/tokens'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type Size = 'md' | 'lg' | 'sm'

const BOX: Record<Variant, string> = {
  primary: 'bg-brand active:bg-brand-dark',
  secondary: 'bg-surface border border-line active:bg-canvas',
  ghost: 'bg-transparent active:bg-canvas',
  danger: 'bg-danger active:opacity-90',
  success: 'bg-success active:opacity-90',
}

const LABEL: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-navy',
  ghost: 'text-brand-ink',
  danger: 'text-white',
  success: 'text-white',
}

const SIZE: Record<Size, string> = {
  sm: 'h-10 px-3.5 rounded-xl',
  md: 'h-12 px-5 rounded-2xl',
  lg: 'h-14 px-6 rounded-2xl',
}

const TEXT_SIZE: Record<Size, string> = { sm: 'text-sm', md: 'text-[15px]', lg: 'text-base' }

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  full = false,
  className = '',
  testID,
}: {
  label: string
  onPress?: () => void
  variant?: Variant
  size?: Size
  loading?: boolean
  disabled?: boolean
  icon?: ReactNode
  full?: boolean
  /** Layout only — spacing and width from the parent. Colour stays with the variant. */
  className?: string
  testID?: string
}) {
  const inert = disabled || loading

  const press = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress?.()
  }

  return (
    <Pressable
      accessibilityRole="button"
      // `disabled` and not only `accessibilityState`: React Native Web reads the prop to render a
      // real disabled control. Without it the button looks greyed out but announces itself as
      // available, and stays focusable.
      disabled={inert}
      accessibilityState={{ disabled: inert, busy: loading }}
      accessibilityLabel={label}
      testID={testID}
      onPress={inert ? undefined : press}
      className={`flex-row items-center justify-center gap-2 ${SIZE[size]} ${BOX[variant]} ${full ? 'w-full' : ''} ${
        inert ? 'opacity-40' : ''
      } ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? COLORS.navy : COLORS.white} />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          <Text className={`font-semibold ${TEXT_SIZE[size]} ${LABEL[variant]}`}>{label}</Text>
        </>
      )}
    </Pressable>
  )
}
