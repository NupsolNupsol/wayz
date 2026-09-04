import type { ReactNode } from 'react'
import { TextInput, View, type TextInputProps } from 'react-native'

import { COLORS } from '@/theme/tokens'
import { Label, Muted } from './Text'

export function Field({
  label,
  hint,
  error,
  required = false,
  children,
  className = '',
}: {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <View className={`gap-1.5 ${className}`}>
      <Label>
        {label}
        {required ? ' *' : ''}
      </Label>
      {children}
      {error ? <Muted className="text-danger">{error}</Muted> : hint ? <Muted>{hint}</Muted> : null}
    </View>
  )
}

export function Input({
  className = '',
  invalid = false,
  ...rest
}: TextInputProps & { className?: string; invalid?: boolean }) {
  return (
    <TextInput
      placeholderTextColor={COLORS.faint}
      className={`h-12 rounded-2xl border bg-surface px-4 text-[15px] text-navy ${
        invalid ? 'border-danger' : 'border-line'
      } ${className}`}
      {...rest}
    />
  )
}

export function TextArea({ className = '', ...rest }: TextInputProps & { className?: string }) {
  return (
    <TextInput
      multiline
      textAlignVertical="top"
      placeholderTextColor={COLORS.faint}
      className={`min-h-[88px] rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] text-navy ${className}`}
      {...rest}
    />
  )
}
