import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'

import { Heading, Label } from './Text'

export function Card({
  title,
  action,
  children,
  className = '',
  onPress,
  testID,
}: {
  title?: string
  /** A button or link that belongs to this card's heading row. */
  action?: ReactNode
  children?: ReactNode
  className?: string
  onPress?: () => void
  testID?: string
}) {
  const inner = (
    <>
      {title || action ? (
        <View className="mb-3 flex-row items-center justify-between gap-3">
          {title ? <Label>{title}</Label> : <View />}
          {action}
        </View>
      ) : null}
      {children}
    </>
  )

  const box = `rounded-xl2 border border-line bg-surface p-4 ${className}`

  if (onPress) {
    return (
      <Pressable accessibilityRole="button" testID={testID} onPress={onPress} className={`${box} active:bg-canvas`}>
        {inner}
      </Pressable>
    )
  }

  return (
    <View className={box} testID={testID}>
      {inner}
    </View>
  )
}

/** A titled block inside a scroll view, with the heading outside the card. */
export function Section({
  title,
  action,
  children,
  className = '',
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <View className={`gap-2 ${className}`}>
      <View className="flex-row items-center justify-between gap-3 px-0.5">
        <Heading>{title}</Heading>
        {action}
      </View>
      {children}
    </View>
  )
}
