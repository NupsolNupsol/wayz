import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'

import { apiMessage } from '@/api/client'
import { Button, Field, Input, RecordCard, RecordList, Sheet, toast } from '@/design'
import { useSession } from '@/features/auth/hooks'
import { useCreateCustomer, useCustomers } from '@/hooks/queries'
import { initials, relativeTime } from '@/lib/format'
import { initialsOf } from '@/lib/workspace'

export default function CustomersScreen() {
  const router = useRouter()
  const { me } = useSession()

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
    <>
      <RecordList
        testID="kiosk-customers"
        title="Customers"
        subtitle="Find someone, or add them"
        initials={initialsOf(me)}
        query={query}
        onQuery={setQuery}
        searchPlaceholder="Search by name or phone"
        rows={data}
        keyOf={(c) => c._id}
        loading={isLoading && !data.length}
        refreshing={isFetching}
        onRefresh={() => void refetch()}
        emptyIcon="Users"
        emptyTitle={query ? 'Nobody matches' : 'No customers yet'}
        emptyMessage={query ? 'Try a shorter search, or add them.' : 'They appear here after their first booking.'}
        renderRow={(c) => (
          <RecordCard
            testID={`customer-${c._id}`}
            icon="User"
            tone="brand"
            title={c.name}
            subtitle={c.phone}
            onPress={() => router.push({ pathname: '/customer/[id]', params: { id: c._id } })}
            meta={
              <>
                {c.email ? <Text className="text-[11px] text-muted">{c.email}</Text> : null}
                {c.bookingCount ? <Text className="text-[11px] text-muted">{c.bookingCount} bookings</Text> : null}
              </>
            }
            right={
              c.lastSeenAt ? (
                <Text className="text-[11px] text-faint">{relativeTime(c.lastSeenAt)}</Text>
              ) : (
                <Text className="text-[11px] text-faint">{initials(c.name)}</Text>
              )
            }
          />
        )}
      />

      {/* Sits outside the list so the sheet is not clipped by the scroll container. */}
      <View className="absolute bottom-6 right-5">
        <Button
          label="Add customer"
          size="lg"
          icon={<Text className="text-[17px] font-bold text-white">+</Text>}
          onPress={() => setAddOpen(true)}
          testID="customers-add"
        />
      </View>

      <Sheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="New customer"
        subtitle="A phone number is what lets you verify them later."
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
    </>
  )
}
