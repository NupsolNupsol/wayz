import { useMemo, useState } from 'react'
import { View } from 'react-native'

import type { PaymentSplit } from '@/api/endpoints'
import { Amount, Body, Card, Input, Label, Muted, OptionRow, Segmented } from '@/components/ui'
import { money } from '@/lib/format'
import type { CardScheme, Order, PaymentMethod } from '@/types'

const SCHEMES: { value: CardScheme; label: string }[] = [
  { value: 'MADA', label: 'Mada' },
  { value: 'VISA', label: 'Visa' },
  { value: 'MASTERCARD', label: 'Mastercard' },
  { value: 'SPAN', label: 'SPAN' },
  { value: 'GCC', label: 'GCC' },
]

export function usePaymentSplits(order: Order | null) {
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'SPLIT'>('CARD')
  const [scheme, setScheme] = useState<CardScheme>('MADA')
  const [cashPart, setCashPart] = useState('')

  const total = order?.balanceDue ?? order?.total ?? 0

  const splits = useMemo<PaymentSplit[]>(() => {
    if (method === 'CASH') return [{ method: 'CASH' as PaymentMethod, amount: total }]
    if (method === 'CARD') return [{ method: 'CARD' as PaymentMethod, amount: total, cardScheme: scheme }]

    const cash = Math.min(total, Math.max(0, Number(cashPart) || 0))
    const card = Math.round((total - cash) * 100) / 100
    const parts: PaymentSplit[] = []
    if (cash > 0) parts.push({ method: 'CASH', amount: cash })
    if (card > 0) parts.push({ method: 'CARD', amount: card, cardScheme: scheme })
    return parts
  }, [method, scheme, cashPart, total])

  const covered = Math.round(splits.reduce((sum, s) => sum + s.amount, 0) * 100) / 100
  const ready = total > 0 ? Math.abs(covered - total) < 0.01 : false

  return { method, setMethod, scheme, setScheme, cashPart, setCashPart, splits, total, covered, ready }
}

export function PaymentPanel({
  order,
  state,
  testID,
}: {
  order: Order | null
  state: ReturnType<typeof usePaymentSplits>
  testID?: string
}) {
  if (!order) return null

  return (
    <View className="gap-4" testID={testID}>
      <Card>
        <View className="gap-1.5">
          {order.lines.map((line, index) => (
            <View key={`${line.name}-${index}`} className="flex-row justify-between gap-3">
              <Muted className="flex-1" numberOfLines={1}>
                {line.name}
                {line.isDeposit ? ' (refundable deposit)' : ''}
              </Muted>
              <Muted>{money(line.unitPrice * line.quantity)}</Muted>
            </View>
          ))}
          <View className="mt-1 flex-row justify-between">
            <Muted>VAT</Muted>
            <Muted>{money(order.vat)}</Muted>
          </View>
          <View className="mt-1 flex-row items-center justify-between border-t border-line pt-2">
            <Body className="font-bold">To pay</Body>
            <Amount className="text-xl">{money(state.total)}</Amount>
          </View>
        </View>
      </Card>

      <Segmented
        value={state.method}
        onChange={state.setMethod}
        testID={testID ? `${testID}-method` : undefined}
        options={[
          { value: 'CARD', label: 'Card' },
          { value: 'CASH', label: 'Cash' },
          { value: 'SPLIT', label: 'Split' },
        ]}
      />

      {state.method !== 'CASH' ? (
        <View className="gap-2">
          <Label>Which card</Label>
          <View className="gap-2">
            {SCHEMES.map((option) => (
              <OptionRow
                key={option.value}
                selected={state.scheme === option.value}
                onPress={() => state.setScheme(option.value)}
                title={option.label}
                testID={`pay-scheme-${option.value}`}
              />
            ))}
          </View>
        </View>
      ) : null}

      {state.method === 'SPLIT' ? (
        <View className="gap-2">
          <Label>Cash part</Label>
          <Input
            value={state.cashPart}
            onChangeText={state.setCashPart}
            placeholder="0.00"
            keyboardType="decimal-pad"
            testID="pay-cash-part"
          />
          <Muted>
            Card covers the rest: {money(Math.max(0, state.total - (Number(state.cashPart) || 0)))}
          </Muted>
        </View>
      ) : null}

      {!state.ready && state.total > 0 ? (
        <Muted className="text-danger">
          The split covers {money(state.covered)} of {money(state.total)}.
        </Muted>
      ) : null}
    </View>
  )
}
