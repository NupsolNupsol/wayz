import { useState } from 'react'
import { View } from 'react-native'

import { apiMessage } from '@/api/client'
import { Body, Button, Card, Field, Icon, Input, ListGroup, ListRow, Muted, Sheet, toast } from '@/design'
import { useCreateCustomer, useCustomers } from '@/hooks/queries'
import { initials } from '@/lib/format'
import { COLORS } from '@/theme/tokens'
import type { Customer } from '@/types'

/**
 * Who the sale is for.
 *
 * Search first, add second: most people at a Riyadh Season counter have been through it before,
 * and typing a name is faster than re-keying a phone number. Once someone is chosen the search
 * collapses to a single row, because the agent's next question is never "who" again.
 */
export function CustomerPicker({
  selected,
  onSelect,
  testID,
}: {
  selected: Customer | null
  onSelect: (customer: Customer | null) => void
  testID?: string
}) {
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const { data = [], isFetching } = useCustomers(query)
  const create = useCreateCustomer()

  const add = () =>
    create.mutate(
      { name: name.trim(), phone: phone.trim(), email: email.trim() || undefined },
      {
        onSuccess: (customer) => {
          toast('success', 'Customer added', customer.name)
          onSelect(customer)
          setAddOpen(false)
          setName('')
          setPhone('')
          setEmail('')
        },
        onError: (e) => toast('danger', 'Could not add the customer', apiMessage(e)),
      },
    )

  if (selected) {
    return (
      <Card testID={testID}>
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-brand">
            <Body className="font-bold text-white">{initials(selected.name)}</Body>
          </View>
          <View className="min-w-0 flex-1">
            <Body className="font-bold" numberOfLines={1}>
              {selected.name}
            </Body>
            <Muted numberOfLines={1}>{selected.phone}</Muted>
          </View>
          <Button
            label="Change"
            variant="ghost"
            size="sm"
            onPress={() => onSelect(null)}
            testID={testID ? `${testID}-change` : undefined}
          />
        </View>
      </Card>
    )
  }

  return (
    <View className="gap-3" testID={testID}>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name or phone"
        autoCapitalize="none"
        autoCorrect={false}
        testID={testID ? `${testID}-search` : undefined}
      />

      {data.length > 0 ? (
        <ListGroup>
          {data.slice(0, 6).map((customer, index) => (
            <View key={customer._id}>
              {index > 0 ? <View className="h-px bg-line" /> : null}
              <ListRow
                testID={`pick-customer-${customer._id}`}
                onPress={() => onSelect(customer)}
                leading={
                  <View className="h-10 w-10 items-center justify-center rounded-2xl bg-canvas">
                    <Body className="text-[13px] font-bold text-muted">{initials(customer.name)}</Body>
                  </View>
                }
                title={customer.name}
                subtitle={customer.phone}
              />
            </View>
          ))}
        </ListGroup>
      ) : (
        <Muted>
          {isFetching ? 'Searching…' : query ? 'Nobody matches — add them below.' : 'Search, or add a new customer.'}
        </Muted>
      )}

      <Button
        label="New customer"
        variant="secondary"
        icon={<Icon name="UserPlus" size={16} color={COLORS.navy} />}
        onPress={() => setAddOpen(true)}
        testID={testID ? `${testID}-add` : undefined}
      />

      <Sheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="New customer"
        subtitle="A phone is what lets you confirm them when the money moves."
        testID="pick-customer-sheet"
        footer={
          <Button
            label="Add & continue"
            size="lg"
            full
            disabled={name.trim().length < 2 || phone.trim().length < 6}
            loading={create.isPending}
            onPress={add}
            testID="pick-customer-submit"
          />
        }
      >
        <Field label="Full name" required>
          <Input value={name} onChangeText={setName} testID="pick-customer-name" />
        </Field>
        <Field label="Phone" required>
          <Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" testID="pick-customer-phone" />
        </Field>
        <Field label="Email" hint="Optional — adds a second way to send their code.">
          <Input
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            testID="pick-customer-email"
          />
        </Field>
      </Sheet>
    </View>
  )
}
