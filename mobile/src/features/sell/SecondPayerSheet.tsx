import { useEffect, useState } from 'react'
import { View } from 'react-native'

import { Body, Button, Field, Input, Muted, Sheet } from '@/design'
import { money, round2 } from '@/lib/format'
import type { Customer } from '@/types'
import { ConfirmCustomer } from './ConfirmCustomer'
import { CustomerPicker } from './CustomerPicker'

export interface SecondPayer {
  customer: Customer
  amount: number
}

/**
 * The other half of a split sale.
 *
 * A customer asks a friend to cover part of it. That friend is a customer in their own right —
 * their half goes on their name and their receipt — so they are found or put on file, confirmed
 * with a code the same way, and only then is there an amount to agree.
 *
 * Half is offered because that is what people mean by splitting it; the agent can type anything
 * else over the top.
 */
export function SecondPayerSheet({
  open,
  total,
  onClose,
  onConfirm,
  testID = 'second-payer',
}: {
  open: boolean
  total: number
  onClose: () => void
  onConfirm: (payer: SecondPayer) => void
  testID?: string
}) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [verified, setVerified] = useState(false)
  const [amount, setAmount] = useState(String(round2(total / 2)))

  // Reopening starts clean: the last friend's confirmation has nothing to do with this sale.
  useEffect(() => {
    if (!open) return
    setCustomer(null)
    setVerified(false)
    setAmount(String(round2(total / 2)))
  }, [open, total])

  // A different person needs their own code.
  useEffect(() => setVerified(false), [customer?._id])

  const share = round2(Math.min(Math.max(0, Number(amount) || 0), total))
  const theirs = round2(total - share)

  const problem = !customer
    ? 'Find them, or add them.'
    : !verified
      ? 'Send them a code and have them read it back.'
      : share <= 0
        ? 'They have to pay something.'
        : theirs <= 0
          ? 'Leave something for the customer to pay.'
          : ''

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Who else is paying"
      subtitle="Their half goes on their own name, so they are confirmed like any customer."
      testID={`${testID}-sheet`}
      footer={
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Button label="Cancel" variant="secondary" full onPress={onClose} testID={`${testID}-cancel`} />
          </View>
          <View className="flex-1">
            <Button
              label={`They pay ${money(share)}`}
              full
              disabled={!!problem}
              onPress={() => customer && onConfirm({ customer, amount: share })}
              testID={`${testID}-confirm`}
            />
          </View>
        </View>
      }
    >
      <CustomerPicker selected={customer} onSelect={setCustomer} testID={`${testID}-picker`} />

      {customer ? (
        <ConfirmCustomer
          phone={customer.phone}
          email={customer.email}
          verified={verified}
          onVerified={setVerified}
          testID={`${testID}-otp`}
        />
      ) : null}

      {customer && verified ? (
        <View className="gap-3" testID={`${testID}-amount-row`}>
          <Field label="Their share" hint={`Half of ${money(total)} is ${money(round2(total / 2))}.`}>
            <Input
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              testID={`${testID}-amount`}
            />
          </Field>
          <View className="flex-row items-center justify-between rounded-2xl border border-line bg-canvas p-3" testID={`${testID}-breakdown`}>
            <Muted>Customer + them</Muted>
            <Body className="font-bold">
              {money(theirs)} + {money(share)}
            </Body>
          </View>
        </View>
      ) : null}

      {problem ? (
        <Muted testID={`${testID}-problem`}>{problem}</Muted>
      ) : null}
    </Sheet>
  )
}
