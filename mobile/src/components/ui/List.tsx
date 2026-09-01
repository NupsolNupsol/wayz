import { ChevronRight } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'

import { COLORS } from '@/theme/tokens'
import { Body, Label, Muted } from './Text'

/**
 * One row in a list: a leading mark, a title, a supporting line, and something on the right.
 * Every list in the app is built from this so they all press, wrap and align identically.
 */
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  chevron = true,
  testID,
}: {
  title: ReactNode
  subtitle?: ReactNode
  leading?: ReactNode
  trailing?: ReactNode
  onPress?: () => void
  chevron?: boolean
  testID?: string
}) {
  const content = (
    <View className="flex-row items-center gap-3 px-4 py-3.5">
      {leading ? <View className="shrink-0">{leading}</View> : null}

      <View className="min-w-0 flex-1 gap-0.5">
        {typeof title === 'string' ? <Body className="font-semibold" numberOfLines={1}>{title}</Body> : title}
        {typeof subtitle === 'string' ? <Muted numberOfLines={2}>{subtitle}</Muted> : subtitle}
      </View>

      {trailing ? <View className="shrink-0 items-end gap-1">{trailing}</View> : null}
      {onPress && chevron ? <ChevronRight size={18} color={COLORS.faint} /> : null}
    </View>
  )

  if (!onPress) return <View testID={testID}>{content}</View>

  return (
    <Pressable accessibilityRole="button" onPress={onPress} testID={testID} className="active:bg-canvas">
      {content}
    </Pressable>
  )
}

/** Rows grouped into one card, hairlines between them and none at the ends. */
export function ListGroup({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <View className={`overflow-hidden rounded-xl2 border border-line bg-surface ${className}`}>{children}</View>
  )
}

export const Divider = () => <View className="h-px bg-line" />

/** A label/value pair — the vocabulary of every detail screen. */
export function KeyValue({ label, value, className = '' }: { label: string; value: ReactNode; className?: string }) {
  return (
    <View className={`gap-1 ${className}`}>
      <Label>{label}</Label>
      {typeof value === 'string' ? <Body className="font-semibold">{value}</Body> : value}
    </View>
  )
}
