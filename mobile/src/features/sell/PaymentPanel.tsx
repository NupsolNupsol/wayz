import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'

import type { PaymentSplit } from '@/api/endpoints'
import { Amount, Body, Button, Card, CheckRow, Field, Icon, Input, Label, Muted, Notice, OptionRow, Segmented } from '@/design'
import { money, round2 } from '@/lib/format'
import { COLORS } from '@/theme/tokens'
import type { CardScheme, Order, PaymentMethod } from '@/types'
import { SecondPayerSheet, type SecondPayer } from './SecondPayerSheet'

const SCHEMES: { value: CardScheme; label: string }[] = [
  { value: 'MADA', label: 'Mada' },
  { value: 'VISA', label: 'Visa' },
  { value: 'MASTERCARD', label: 'Mastercard' },
  { value: 'SPAN', label: 'SPAN' },
  { value: 'GCC', label: 'GCC' },
]

/**
 * How the sale gets paid for.
 *
 * Two questions, kept apart because they are genuinely separate: *how* (card or cash, and which
 * card) and *who* — one customer, or two people splitting it. A split writes two payments against
 * one booking, each on the name of whoever handed the money over, which is what the second person
 * gets a receipt for and what the till reconciles against.
 */
export function usePaymentSplits(order: Order | null) {
  const total = order?.balanceDue ?? order?.total ?? 0

  const [method, setMethod] = useState<PaymentMethod>('CARD')
  const [scheme, setScheme] = useState<CardScheme>('MADA')

  const [split, setSplit] = useState(false)
  const [payerOpen, setPayerOpen] = useState(false)
  const [payer, setPayer] = useState<SecondPayer | null>(null)
  const [firstAmount, setFirstAmount] = useState(total)
  const [secondMethod, setSecondMethod] = useState<PaymentMethod>('CASH')
  const [secondScheme, setSecondScheme] = useState<CardScheme>('MADA')

  useEffect(() => setFirstAmount(total), [total])

  /** Ticking the box asks who straight away — there is nothing to configure until we know. */
  const openSplit = (on: boolean) => {
    setSplit(on)
    if (on) setPayerOpen(true)
    else setPayer(null)
  }

  const takeSecondPayer = (next: SecondPayer) => {
    setPayer(next)
    setPayerOpen(false)
    setFirstAmount(round2(total - next.amount))
  }

  /** Backing out of the sheet leaves an ordinary single payment rather than a half-set split. */
  const cancelSplit = () => {
    setPayerOpen(false)
    if (!payer) setSplit(false)
  }

  const firstPart = Math.min(Math.max(0, round2(firstAmount)), round2(total))
  const secondPart = round2(total - firstPart)

  const splits = useMemo<PaymentSplit[]>(() => {
    const card = (m: PaymentMethod, s: CardScheme) => (m === 'CARD' ? { cardScheme: s } : {})
    if (!split || !payer) return [{ method, amount: total, ...card(method, scheme) }]
    return [
      { method, amount: firstPart, ...card(method, scheme) },
      { method: secondMethod, amount: secondPart, ...card(secondMethod, secondScheme), payerId: payer.customer._id },
    ]
  }, [split, payer, method, scheme, secondMethod, secondScheme, firstPart, secondPart, total])

  const blockedBecause =
    total <= 0
      ? 'There is nothing to pay.'
      : split && !payer
        ? 'Say who is paying the other half.'
        : split && secondPart <= 0
          ? 'Leave something for the other person to pay.'
          : split && firstPart <= 0
            ? 'The customer has to pay something too.'
            : ''

  return {
    total,
    method,
    setMethod,
    scheme,
    setScheme,
    split,
    openSplit,
    payer,
    payerOpen,
    setPayerOpen,
    takeSecondPayer,
    cancelSplit,
    firstAmount,
    setFirstAmount,
    firstPart,
    secondPart,
    secondMethod,
    setSecondMethod,
    secondScheme,
    setSecondScheme,
    splits,
    blockedBecause,
    ready: !blockedBecause,
  }
}

export function PaymentPanel({
  order,
  state,
  testID = 'payment',
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
            <Amount className="text-xl" testID={`${testID}-total`}>
              {money(state.total)}
            </Amount>
          </View>
        </View>
      </Card>

      <Segmented
        value={state.method}
        onChange={(next) => state.setMethod(next as PaymentMethod)}
        testID={`${testID}-method`}
        options={[
          { value: 'CARD', label: 'Card' },
          { value: 'CASH', label: 'Cash' },
        ]}
      />

      {state.method === 'CARD' ? (
        <View className="gap-2">
          <Label>Which card</Label>
          {SCHEMES.map((option) => (
            <OptionRow
              key={option.value}
              selected={state.scheme === option.value}
              onPress={() => state.setScheme(option.value)}
              title={option.label}
              testID={`${testID}-scheme-${option.value}`}
            />
          ))}
        </View>
      ) : null}

      <CheckRow
        checked={state.split}
        onChange={state.openSplit}
        title="Two people are paying"
        subtitle="The second person is confirmed and receipted in their own name."
        testID={`${testID}-split-toggle`}
      />

      {state.split && state.payer ? (
        <View className="gap-3" testID={`${testID}-split`}>
          <View className="flex-row items-center gap-3 rounded-2xl border border-brand/40 bg-brand-soft p-3" testID={`${testID}-split-payer`}>
            <Icon name="Users" size={16} color={COLORS.brandDark} />
            <View className="min-w-0 flex-1">
              <Body className="font-bold" numberOfLines={1}>
                {state.payer.customer.name}
              </Body>
              <Muted>pays {money(state.secondPart)}</Muted>
            </View>
            <Button
              label="Change"
              variant="ghost"
              size="sm"
              onPress={() => state.setPayerOpen(true)}
              testID={`${testID}-split-change`}
            />
          </View>

          <Field label="The customer pays" hint={`The rest, ${money(state.secondPart)}, is on ${state.payer.customer.name}.`}>
            <Input
              value={String(state.firstAmount)}
              onChangeText={(value) => state.setFirstAmount(Number(value) || 0)}
              keyboardType="decimal-pad"
              testID={`${testID}-split-amount`}
            />
          </Field>

          <View className="gap-2">
            <Label>How they are paying</Label>
            <Segmented
              value={state.secondMethod}
              onChange={(next) => state.setSecondMethod(next as PaymentMethod)}
              testID={`${testID}-split-method`}
              options={[
                { value: 'CASH', label: 'Cash' },
                { value: 'CARD', label: 'Card' },
              ]}
            />
            {state.secondMethod === 'CARD' ? (
              <View className="gap-2">
                {SCHEMES.map((option) => (
                  <OptionRow
                    key={option.value}
                    selected={state.secondScheme === option.value}
                    onPress={() => state.setSecondScheme(option.value)}
                    title={option.label}
                    testID={`${testID}-split-scheme-${option.value}`}
                  />
                ))}
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {state.blockedBecause ? (
        <Notice tone="warn" testID={`${testID}-blocked`}>
          <Body>{state.blockedBecause}</Body>
        </Notice>
      ) : null}

      <SecondPayerSheet
        open={state.payerOpen}
        total={state.total}
        onClose={state.cancelSplit}
        onConfirm={state.takeSecondPayer}
        testID={`${testID}-second-payer`}
      />
    </View>
  )
}
