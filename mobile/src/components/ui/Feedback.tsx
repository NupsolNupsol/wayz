import type { ReactNode } from 'react'
import { ActivityIndicator, View } from 'react-native'

import { COLORS } from '@/theme/tokens'
import { Body, Heading, Muted } from './Text'

export function Loading({ label }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 py-16" testID="loading">
      <ActivityIndicator size="large" color={COLORS.brand} />
      {label ? <Muted>{label}</Muted> : null}
    </View>
  )
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  testID,
}: {
  icon?: ReactNode
  title: string
  message?: string
  action?: ReactNode
  testID?: string
}) {
  return (
    <View className="items-center justify-center gap-2 rounded-xl2 border border-line bg-surface px-6 py-12" testID={testID}>
      {icon ? <View className="mb-1 h-14 w-14 items-center justify-center rounded-2xl bg-canvas">{icon}</View> : null}
      <Heading className="text-center">{title}</Heading>
      {message ? <Muted className="text-center">{message}</Muted> : null}
      {action ? <View className="mt-3">{action}</View> : null}
    </View>
  )
}

/** A failure the agent can act on: what went wrong, and a way to try again. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: ReactNode }) {
  return (
    <View className="gap-2 rounded-xl2 border border-danger/30 bg-danger-soft p-4" testID="error-state">
      <Heading className="text-danger">Something went wrong</Heading>
      <Body className="text-navy">{message}</Body>
      {onRetry ? <View className="mt-2 self-start">{onRetry}</View> : null}
    </View>
  )
}

/** A quiet note that explains a rule, rather than reporting a failure. */
export function Notice({
  tone = 'info',
  children,
  testID,
}: {
  tone?: 'info' | 'warn' | 'danger' | 'success'
  children: ReactNode
  testID?: string
}) {
  const box = {
    info: 'border-info/30 bg-info-soft',
    warn: 'border-warn/30 bg-warn-soft',
    danger: 'border-danger/30 bg-danger-soft',
    success: 'border-success/30 bg-success-soft',
  }[tone]

  return (
    <View className={`rounded-2xl border p-3 ${box}`} testID={testID}>
      {children}
    </View>
  )
}
