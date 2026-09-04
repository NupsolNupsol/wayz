import { Check, Minus, Plus } from 'lucide-react-native'
import { Pressable, Text, View } from 'react-native'

import { COLORS } from '@/theme/tokens'
import { Body, Muted } from './Text'

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  testID,
}: {
  value: T
  options: { value: T; label: string; count?: number }[]
  onChange: (value: T) => void
  testID?: string
}) {
  return (
    <View className="flex-row rounded-2xl border border-line bg-surface p-1" testID={testID}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            testID={testID ? `${testID}-${option.value}` : undefined}
            className={`h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl ${active ? 'bg-brand' : ''}`}
          >
            <Text className={`text-[13px] font-semibold ${active ? 'text-white' : 'text-muted'}`}>{option.label}</Text>
            {option.count !== undefined ? (
              <View className={`rounded-full px-1.5 ${active ? 'bg-white/25' : 'bg-canvas'}`}>
                <Text className={`text-[11px] font-bold ${active ? 'text-white' : 'text-muted'}`}>{option.count}</Text>
              </View>
            ) : null}
          </Pressable>
        )
      })}
    </View>
  )
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  suffix,
  testID,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  testID?: string
}) {
  const clamp = (next: number) => onChange(Math.min(max, Math.max(min, next)))

  return (
    <View className="flex-row items-center gap-3" testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease"
        onPress={() => clamp(value - step)}
        disabled={value <= min}
        testID={testID ? `${testID}-minus` : undefined}
        className={`h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface active:bg-canvas ${
          value <= min ? 'opacity-40' : ''
        }`}
      >
        <Minus size={18} color={COLORS.navy} />
      </Pressable>

      <View className="min-w-[72px] items-center">
        <Text className="text-xl font-extrabold text-navy" style={{ fontVariant: ['tabular-nums'] }} testID={testID ? `${testID}-value` : undefined}>
          {value}
        </Text>
        {suffix ? <Muted className="text-[11px]">{suffix}</Muted> : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase"
        onPress={() => clamp(value + step)}
        disabled={value >= max}
        testID={testID ? `${testID}-plus` : undefined}
        className={`h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface active:bg-canvas ${
          value >= max ? 'opacity-40' : ''
        }`}
      >
        <Plus size={18} color={COLORS.navy} />
      </Pressable>
    </View>
  )
}

export function CheckRow({
  checked,
  onChange,
  title,
  subtitle,
  testID,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  title: string
  subtitle?: string
  testID?: string
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      testID={testID}
      className={`flex-row items-start gap-3 rounded-2xl border p-3.5 ${
        checked ? 'border-brand bg-brand-soft' : 'border-line bg-surface'
      }`}
    >
      <View
        className={`mt-0.5 h-6 w-6 items-center justify-center rounded-lg border-2 ${
          checked ? 'border-brand bg-brand' : 'border-line'
        }`}
      >
        {checked ? <Check size={15} color={COLORS.white} strokeWidth={3} /> : null}
      </View>
      <View className="flex-1 gap-0.5">
        <Body className="font-semibold">{title}</Body>
        {subtitle ? <Muted>{subtitle}</Muted> : null}
      </View>
    </Pressable>
  )
}

export function OptionRow({
  selected,
  onPress,
  title,
  subtitle,
  trailing,
  testID,
}: {
  selected: boolean
  onPress: () => void
  title: string
  subtitle?: string
  trailing?: React.ReactNode
  testID?: string
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={testID}
      className={`flex-row items-center gap-3 rounded-2xl border p-3.5 ${
        selected ? 'border-brand bg-brand-soft' : 'border-line bg-surface'
      }`}
    >
      <View className={`h-5 w-5 items-center justify-center rounded-full border-2 ${selected ? 'border-brand' : 'border-line'}`}>
        {selected ? <View className="h-2.5 w-2.5 rounded-full bg-brand" /> : null}
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Body className="font-semibold" numberOfLines={1}>{title}</Body>
        {subtitle ? <Muted numberOfLines={2}>{subtitle}</Muted> : null}
      </View>
      {trailing}
    </Pressable>
  )
}
