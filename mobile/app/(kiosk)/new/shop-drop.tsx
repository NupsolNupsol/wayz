import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { View } from 'react-native'

import { apiMessage } from '@/api/client'
import type { BagInput } from '@/api/endpoints'
import {
  Body,
  Button,
  Card,
  Icon,
  Input,
  Label,
  Loading,
  Muted,
  Notice,
  Ref,
  Screen,
  ScreenHeader,
  Section,
  StepBar,
  Stepper,
  toast,
  type WizardStep,
} from '@/design'
import { StoreSheet } from '@/features/booking/StoreSheet'
import {
  ConfirmCustomer,
  CustomerPicker,
  InstancePicker,
  PaymentPanel,
  unitsForEngine,
  usePaymentSplits,
} from '@/features/sell'
import { useCreateBooking, useOrder, usePay, useProducts, useReserve, useUnits } from '@/hooks/queries'
import { money } from '@/lib/format'
import { KIOSK_TABS } from '@/lib/navigation'
import { COLORS } from '@/theme/tokens'
import type { AssetUnit, Booking, Customer } from '@/types'

const STEPS: WizardStep[] = [
  { key: 'customer', label: 'Customer' },
  { key: 'bags', label: 'Bags' },
  { key: 'compartment', label: 'Compartment' },
  { key: 'payment', label: 'Payment' },
  { key: 'store', label: 'Store' },
]

interface BagRow {
  description: string
  weight: number
}

/**
 * Bag storage, start to finish.
 *
 * The agent picks a real compartment off their own wall rather than a recommended *size*: a
 * suggestion that turns out to be occupied, or to belong to the desk next door, is refused at
 * reservation with the customer already paying. What is on this screen is what is on that wall.
 */
export default function ShopDrop() {
  const [step, setStep] = useState(0)

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [bags, setBags] = useState<BagRow[]>([{ description: '', weight: 8 }])
  // One hour, matching the web counter — an untouched field must never inflate the quote.
  const [duration, setDuration] = useState(1)
  const [unitId, setUnitId] = useState('')
  const [booking, setBooking] = useState<Booking | null>(null)
  const [storeOpen, setStoreOpen] = useState(false)

  const products = useProducts('SHOP_AND_DROP')
  const units = useUnits()
  const create = useCreateBooking()
  const pay = usePay()
  const reserve = useReserve()
  const order = useOrder(booking?.id)
  const payment = usePaymentSplits(order.data ?? null)

  const bagInputs = useMemo<BagInput[]>(
    () =>
      bags.map((bag, index) => ({
        description: bag.description.trim() || `Bag ${index + 1}`,
        weight: bag.weight,
      })),
    [bags],
  )

  const compartments = useMemo(
    () => unitsForEngine(units.data ?? [], 'SHOP_AND_DROP', products.data ?? []),
    [units.data, products.data],
  )
  const chosen = compartments.find((u) => u._id === unitId) ?? null

  /** The compartment decides what is sold: its type is priced by exactly one product. */
  const productFor = (unit: AssetUnit) =>
    (products.data ?? []).find((p) => p._id === unit.productId) ??
    (products.data ?? []).find((p) => p.assetTypeId === unit.assetTypeId) ??
    null

  const chooseCustomer = (next: Customer | null) => {
    setCustomer(next)
    setConfirmed(false)
  }

  const hold = () => {
    if (!customer || !chosen) return
    const product = productFor(chosen)
    if (!product) {
      toast('danger', 'Nothing to sell', `${chosen.identifier} has no Shop & Drop price set up.`)
      return
    }

    create.mutate(
      {
        customerId: customer._id,
        engineKind: 'SHOP_AND_DROP',
        productId: product._id,
        durationMin: duration * 60,
        bags: bagInputs,
        metadata: { assetTypeId: chosen.assetTypeId },
      },
      {
        onSuccess: (result) => {
          setBooking(result.booking)
          setStep(3)
        },
        onError: (e) => toast('danger', 'Could not create the booking', apiMessage(e)),
      },
    )
  }

  const confirmPayment = () => {
    if (!booking) return
    pay.mutate(
      { id: booking.id, splits: payment.splits },
      {
        onSuccess: () => {
          toast('success', 'Payment taken', 'The timer does not start until the bags are scanned in.')
          // Hold the compartment the agent actually chose, not whatever the server would pick.
          reserve.mutate(
            { id: booking.id, unitId: unitId || undefined },
            {
              onSuccess: (reserved) => {
                setBooking(reserved)
                setStep(4)
              },
              onError: (e) => toast('danger', 'Could not reserve the compartment', apiMessage(e)),
            },
          )
        },
        onError: (e) => toast('danger', 'Payment refused', apiMessage(e)),
      },
    )
  }

  const reservedUnit =
    (units.data ?? []).find((u) => u._id === (booking?.reservation?.assetUnitId ?? booking?.assetUnitId)) ?? chosen

  const tooSmall = !!chosen?.maxBags && bags.length > chosen.maxBags

  return (
    <Screen
      scroll
      testID="shop-drop"
      header={<ScreenHeader title="Shop & Drop" subtitle="Bag storage, start to finish" fallback={KIOSK_TABS.sell} />}
      footer={<Footer />}
    >
      <View className="mb-4">
        <StepBar steps={STEPS} current={step} onStep={setStep} canRevisit={(index) => index < step && !booking} />
      </View>

      {step === 0 ? (
        <Section title="Who is the customer">
          <View className="gap-4">
            <CustomerPicker selected={customer} onSelect={chooseCustomer} testID="sd-customer" />
            {customer ? (
              <View className="gap-2">
                <Label>Confirm it is them</Label>
                <Muted>No money can be taken until they read a code back to you.</Muted>
                <ConfirmCustomer
                  phone={customer.phone}
                  email={customer.email}
                  verified={confirmed}
                  onVerified={setConfirmed}
                  testID="sd-confirm"
                />
              </View>
            ) : null}
          </View>
        </Section>
      ) : null}

      {step === 1 ? (
        <Section title="What are they leaving">
          <View className="gap-3">
            <Muted>
              Each bag gets its own barcode; several can share one compartment. The weight is what the incident
              report refers back to if something is disputed.
            </Muted>

            {bags.map((bag, index) => (
              <Card key={index} testID={`sd-bag-${index + 1}`}>
                <View className="gap-3">
                  <View className="flex-row items-center justify-between">
                    <Label>Bag {index + 1}</Label>
                    {bags.length > 1 ? (
                      <Body
                        className="font-semibold text-danger"
                        onPress={() => setBags((prev) => prev.filter((_, i) => i !== index))}
                        testID={`sd-bag-remove-${index + 1}`}
                      >
                        Remove
                      </Body>
                    ) : null}
                  </View>

                  <Input
                    value={bag.description}
                    onChangeText={(value) =>
                      setBags((prev) => prev.map((b, i) => (i === index ? { ...b, description: value } : b)))
                    }
                    placeholder={`Bag ${index + 1} — e.g. Black cabin case`}
                    testID={`sd-bag-desc-${index + 1}`}
                  />

                  <View className="flex-row items-center justify-between">
                    <Label>Weight (kg)</Label>
                    <Stepper
                      value={bag.weight}
                      onChange={(value) =>
                        setBags((prev) => prev.map((b, i) => (i === index ? { ...b, weight: value } : b)))
                      }
                      min={1}
                      max={40}
                      testID={`sd-bag-weight-${index + 1}`}
                    />
                  </View>
                </View>
              </Card>
            ))}

            <Button
              label="Add another bag"
              variant="secondary"
              onPress={() => setBags((prev) => [...prev, { description: '', weight: 8 }])}
              testID="sd-add-bag"
            />
          </View>
        </Section>
      ) : null}

      {step === 2 ? (
        <Section title="Where the bags go">
          <View className="gap-4">
            {units.isLoading || products.isLoading ? (
              <Loading label="Reading your wall…" />
            ) : (
              <InstancePicker
                units={compartments}
                value={unitId}
                onChange={setUnitId}
                label="Which compartment"
                emptyMessage="No compartment is free at this desk. Try another kiosk, or wait for a collection."
                testID="sd-compartments"
              />
            )}

            {tooSmall ? (
              <Notice tone="warn" testID="sd-too-small">
                <Body>
                  {chosen?.identifier} holds {chosen?.maxBags} bags and you have {bags.length}. Pick a bigger one, or
                  split them across two bookings.
                </Body>
              </Notice>
            ) : null}

            <Card>
              <View className="flex-row items-center justify-between">
                <View className="min-w-0 flex-1">
                  <Label>How long</Label>
                  <Muted>Hours of storage</Muted>
                </View>
                <Stepper value={duration} onChange={setDuration} min={1} max={24} suffix="hours" testID="sd-duration" />
              </View>
            </Card>

            {chosen ? (
              <Card testID="sd-chosen">
                <View className="flex-row items-center justify-between gap-3">
                  <View className="min-w-0 flex-1">
                    <Label>Chosen</Label>
                    <Ref className="text-lg">{chosen.identifier}</Ref>
                    <Muted numberOfLines={1}>{productFor(chosen)?.name ?? chosen.assetTypeName}</Muted>
                  </View>
                  <Icon name="Grid3x3" size={20} color={COLORS.brand} />
                </View>
              </Card>
            ) : null}
          </View>
        </Section>
      ) : null}

      {step === 3 ? (
        <Section title="Take payment">
          {order.isLoading ? <Loading /> : <PaymentPanel order={order.data ?? null} state={payment} testID="sd-payment" />}
        </Section>
      ) : null}

      {step === 4 && booking ? (
        <Section title="Assign & store">
          <View className="gap-3">
            <Notice tone="info">
              <Body>
                Paying confirmed the booking. The clock starts only when you scan the compartment and every bag.
              </Body>
            </Notice>

            <Card>
              <View className="gap-2">
                <Label>Reserved compartment</Label>
                <Ref className="text-lg">{reservedUnit?.identifier ?? 'Reserving…'}</Ref>
                <Muted>{booking.packingPlan?.priceCalculationSummary}</Muted>
              </View>
            </Card>

            <Card>
              <View className="gap-2">
                <Label>Bag labels</Label>
                {booking.bags.map((bag) => (
                  <View key={bag.barcode} className="flex-row items-center justify-between gap-3">
                    <Body className="flex-1" numberOfLines={1}>
                      {bag.description}
                    </Body>
                    <Ref className="text-[12px] text-muted">{bag.barcode}</Ref>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        </Section>
      ) : null}

      {booking ? (
        <StoreSheet
          open={storeOpen}
          onClose={() => setStoreOpen(false)}
          booking={booking}
          unitIdentifier={reservedUnit?.identifier ?? null}
        />
      ) : null}
    </Screen>
  )

  function Footer() {
    if (step === 0) {
      return (
        <Button
          label="Continue"
          size="lg"
          full
          disabled={!customer || !confirmed}
          onPress={() => setStep(1)}
          testID="sd-next-customer"
        />
      )
    }

    if (step === 1) {
      return (
        <Button
          label="Choose a compartment"
          size="lg"
          full
          disabled={bags.length === 0}
          onPress={() => setStep(2)}
          testID="sd-next-bags"
        />
      )
    }

    if (step === 2) {
      return (
        <Button
          label="Continue to payment"
          size="lg"
          full
          disabled={!unitId || tooSmall}
          loading={create.isPending}
          onPress={hold}
          testID="sd-next-compartment"
        />
      )
    }

    if (step === 3) {
      return (
        <Button
          label={`Take ${money(payment.total)}`}
          size="lg"
          full
          disabled={!payment.ready}
          loading={pay.isPending || reserve.isPending}
          onPress={confirmPayment}
          testID="sd-pay"
        />
      )
    }

    return (
      <View className="gap-2">
        <Button
          label="Scan in & confirm storage"
          size="lg"
          full
          icon={<Icon name="ScanLine" size={18} color={COLORS.white} />}
          onPress={() => setStoreOpen(true)}
          testID="sd-store"
        />
        <Button
          label="Open the booking"
          variant="secondary"
          full
          onPress={() => booking && router.replace({ pathname: '/booking/[id]', params: { id: booking.id } })}
          testID="sd-open-booking"
        />
      </View>
    )
  }
}
