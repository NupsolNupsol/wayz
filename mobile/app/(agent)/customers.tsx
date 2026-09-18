import { router } from 'expo-router'
import { useState } from 'react'
import { FlatList, View } from 'react-native'

import { apiMessage } from '@/api/client'
import { AppHeader } from '@/components/AppHeader'
import { Icon } from '@/components/Icon'
import {
  Body,
  Button,
  EmptyState,
  Field,
  Input,
  ListGroup,
  ListRow,
  Loading,
  Muted,
  Screen,
  Sheet,
  toast,
} from '@/components/ui'
import { useCreateCustomer, useCustomers } from '@/hooks/queries'
import { initials, relativeTime } from '@/lib/format'
import { COLORS } from '@/theme/tokens'

export default function Customers() {
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const { data = [], isLoading, isFetching, refetch } = useCustomers(query)
  const create = useCreateCustomer()

  const submit = () =>
    create.mutate(
      { name: name.trim(), phone: phone.trim(), email: email.trim() || undefined },
      {
        onSuccess: (customer) => {
          toast('success', 'Customer added', customer.name)
          setAddOpen(false)
          setName('')
          setPhone('')
          setEmail('')
        },
        onError: (e) => toast('danger', 'Could not add the customer', apiMessage(e)),
      },
    )

  return (
    <Screen padded={false} testID="customers">
      <View className="gap-3 px-4 pb-3 pt-2">
        <AppHeader
          back
          title="Customers"
          subtitle="Find someone, or add them"
          actions={<Button label="Add" size="sm" onPress={() => setAddOpen(true)} testID="customers-add" />}
        />
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or phone"
          autoCapitalize="none"
          autoCorrect={false}
          testID="customers-search"
        />
      </View>

      {isLoading && !data.length ? (
        <Loading />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item._id}
          onRefresh={() => void refetch()}
          refreshing={isFetching}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-4 pb-6"
          ListEmptyComponent={
            <EmptyState
              icon={<Icon name="Users" size={24} color={COLORS.faint} />}
              title={query ? 'Nobody matches' : 'No customers yet'}
              message={query ? 'Try a shorter search, or add them.' : 'They appear here after their first booking.'}
              testID="customers-empty"
            />
          }
          renderItem={({ item, index }) => (
            <ListGroup className={index === 0 ? '' : 'mt-2'}>
              <ListRow
                testID={`customer-${item._id}`}
                onPress={() => router.push({ pathname: '/customer/[id]', params: { id: item._id } })}
                leading={
                  <View className="h-10 w-10 items-center justify-center rounded-2xl bg-canvas">
                    <Body className="text-[13px] font-bold text-muted">{initials(item.name)}</Body>
                  </View>
                }
                title={item.name}
                subtitle={item.phone}
                trailing={item.lastSeenAt ? <Muted className="text-[11px]">{relativeTime(item.lastSeenAt)}</Muted> : undefined}
              />
            </ListGroup>
          )}
        />
      )}

      <Sheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="New customer"
        subtitle="A phone is what lets you verify them later."
        testID="customer-add-sheet"
        footer={
          <Button
            label="Add customer"
            size="lg"
            full
            disabled={name.trim().length < 2 || phone.trim().length < 6}
            loading={create.isPending}
            onPress={submit}
            testID="customer-add-submit"
          />
        }
      >
        <Field label="Full name" required>
          <Input value={name} onChangeText={setName} placeholder="Ahmed Saleh" testID="customer-name" />
        </Field>
        <Field label="Phone" required>
          <Input value={phone} onChangeText={setPhone} placeholder="05xxxxxxxx" keyboardType="phone-pad" testID="customer-phone" />
        </Field>
        <Field label="Email" hint="Optional, but it adds a second way to verify them.">
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="name@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            testID="customer-email"
          />
        </Field>
      </Sheet>
    </Screen>
  )
}
