import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'

import { apiMessage } from '@/api/client'
import {
  Amount,
  Body,
  Button,
  Card,
  CheckRow,
  Icon,
  Label,
  Loading,
  Muted,
  Notice,
  OptionRow,
  Ref,
  Screen,
  ScreenHeader,
  Section,
  StepBar,
  Stepper,
  toast,
  type WizardStep,
} from '@/design'
import { engineLabel } from '@/config/engines'
import {
  ConfirmCustomer,
  CustomerPicker,
  InstancePicker,
  PaymentPanel,
  boatAsUnit,
  seatsCaption,
  unitsOfKind,
  usePaymentSplits,
} from '@/features/sell'
import { useBoats, useCreateBooking, useOrder, usePay, useProducts, useTransition, useUnits } from '@/hooks/queries'
import { money } from '@/lib/format'
import { KIOSK_TABS } from '@/lib/navigation'
import { COLORS } from '@/theme/tokens'
import type { Booking, Customer, EngineKind, Product } from '@/types'

const STEPS: WizardStep[] = [
  { key: 'product', label: 'Item' },
  { key: 'customer', label: 'Customer' },
  { key: 'unit', label: 'Which one' },
  { key: 'payment', label: 'Payment' },
  { key: 'fulfil', label: 'Hand over' },
]

/** What "start it" means on each activity, and the box the server insists is ticked first. */
const FULFILMENT: Partial<
  Record<
    EngineKind,
    { code: string; label: string; prompt: string; flag: 'inspectionDone' | 'boardingVerified' | 'safetyAck' }
  >
> = {
  MOBILITY: {
    code: 'TO_HANDOVER',
    label: 'Confirm handover & start',
    prompt: 'Condition inspection done',
    flag: 'inspectionDone',
  },
  LAGOON: {
    code: 'TO_STARTED',
    label: 'Verify boarding & start',
    prompt: 'Boarding count verified',
    flag: 'boardingVerified',
  },
  ANAAM: {
    code: 'TO_STARTED',
    label: 'Confirm safety & start',
    prompt: 'Safety checklist signed',
    flag: 'safetyAck',
  },
}

/**
 * Renting something out, in the order the counter actually works.
 *
 * What is being taken, who is taking it, *which one* they are getting, the money, and the handover
 * that starts the clock. The unit matters as much as the kind: the server binds the sale to a
 * named scooter or hull at this desk and refuses one that is busy or belongs to another kiosk.
 */
export default function Rental() {
  const params = useLocalSearchParams<{ engine?: string }>()
  const engine = (params.engine as EngineKind) ?? 'MOBILITY'
  const fulfilment = FULFILMENT[engine]
  const isLagoon = engine === 'LAGOON'

  const [step, setStep] = useState(0)
  const [product, setProduct] = useState<Product | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [unitId, setUnitId] = useState('')
  const [duration, setDuration] = useState(1)
  const [visitors, setVisitors] = useState(1)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)

  const products = useProducts(engine)
  const units = useUnits()
  const create = useCreateBooking()
  const pay = usePay()
  const transition = useTransition()
  const order = useOrder(booking?.id)
  const payment = usePaymentSplits(order.data ?? null)

  const byDuration = product?.billingModel === 'DURATION_BASED'

  /**
   * A boat is picked by room, everything else by status.
   *
   * A half-full hull is still an AVAILABLE asset, so its status says nothing about whether this
   * party fits — the lagoon list comes from the seat count instead, and the party can never be
   * larger than what is left on the one chosen.
   */
  const boats = useBoats(product?.assetTypeId ?? undefined, isLagoon && !!product?.assetTypeId)
  const boatRooms = useMemo(() => boats.data ?? [], [boats.data])
  const kindUnits = useMemo(
    () => (isLagoon ? boatRooms.map(boatAsUnit) : unitsOfKind(units.data ?? [], product?.assetTypeId)),
    [isLagoon, boatRooms, units.data, product?.assetTypeId],
  )
  const boat = boatRooms.find((b) => b._id === unitId) ?? null
  const seatsLeft = isLagoon ? (boat?.free ?? 0) : (kindUnits.find((u) => u._id === unitId)?.seats ?? 0)

  /** Some products are not a physical thing at this desk — those skip the unit step entirely. */
  const picksAUnit = !!product?.assetTypeId

  /**
   * Seats can go while the sale is being written up: the list polls, and another desk may fill the
   * hull. The party comes back down to what is left rather than sitting on a number the server is
   * about to refuse — and a boat that filled up entirely is dropped so the agent picks again.
   */
  useEffect(() => {
    if (!isLagoon || !boat) return
    if (boat.free === 0) {
      setUnitId('')
      toast('warn', `${boat.identifier} just filled up`, 'Choose another boat.')
      return
    }
    setVisitors((n) => Math.min(Math.max(1, n), boat.free))
  }, [isLagoon, boat])

  const chooseCustomer = (next: Customer | null) => {
    setCustomer(next)
    setConfirmed(false)
  }

  const chooseProduct = (next: Product) => {
    setProduct(next)
    setUnitId('')
  }

  const startBooking = () => {
    if (!customer || !product) return
    create.mutate(
      {
        customerId: customer._id,
        engineKind: engine,
        productId: product._id,
        durationMin: byDuration ? duration * 60 : undefined,
        quantity: byDuration ? undefined : Math.max(1, visitors),
        // A boat is booked by hull because seats are counted against it; everything else binds its
        // unit at handover, when the agent physically hands the thing over.
        unitId: isLagoon && unitId ? unitId : undefined,
        metadata: { visitors },
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
          toast('success', 'Payment taken', fulfilment ? 'Now hand it over to start the clock.' : undefined)
          setStep(4)
        },
        onError: (e) => toast('danger', 'Payment refused', apiMessage(e)),
      },
    )
  }

  const handOver = () => {
    if (!booking || !fulfilment) return
    transition.mutate(
      {
        id: booking.id,
        code: fulfilment.code,
        payload: {
          [fulfilment.flag]: true,
          durationMin: byDuration ? duration * 60 : undefined,
          ...(unitId && !isLagoon ? { unitId } : {}),
        },
      },
      {
        onSuccess: () => {
          toast('success', 'Handed over', 'The session is running.')
          router.replace({ pathname: '/booking/[id]', params: { id: booking.id } })
        },
        onError: (e) => toast('danger', 'Could not start', apiMessage(e)),
      },
    )
  }

  const chosenUnit = kindUnits.find((u) => u._id === unitId)

  return (
    <Screen
      scroll
      testID="rental"
      header={<ScreenHeader title={engineLabel(engine)} subtitle="Rent something out" fallback={KIOSK_TABS.sell} />}
      footer={<Footer />}
    >
      <View className="mb-4">
        <StepBar steps={STEPS} current={step} onStep={setStep} canRevisit={(index) => index < step && !booking} />
      </View>

      {step === 0 ? (
        <Section title="What are they taking">
          {products.isLoading ? (
            <Loading />
          ) : (
            <View className="gap-2">
              {(products.data ?? [])
                .filter((p) => p.active)
                .map((item) => (
                  <OptionRow
                    key={item._id}
                    selected={product?._id === item._id}
                    onPress={() => chooseProduct(item)}
                    title={item.name}
                    subtitle={item.depositRequired > 0 ? `Deposit ${money(item.depositRequired)}` : item.category}
                    trailing={<Amount>{money(item.basePrice)}</Amount>}
                    testID={`rental-product-${item._id}`}
                  />
                ))}
            </View>
          )}
        </Section>
      ) : null}

      {step === 1 ? (
        <Section title="Who is taking it">
          <View className="gap-4">
            <CustomerPicker selected={customer} onSelect={chooseCustomer} testID="rental-customer" />
            {customer ? (
              <View className="gap-2">
                <Label>Confirm it is them</Label>
                <Muted>No money can be taken until they read a code back to you.</Muted>
                <ConfirmCustomer
                  phone={customer.phone}
                  email={customer.email}
                  verified={confirmed}
                  onVerified={setConfirmed}
                  testID="rental-confirm"
                />
              </View>
            ) : null}
          </View>
        </Section>
      ) : null}

      {step === 2 ? (
        <Section title={picksAUnit ? 'Which one, and for how long' : 'For how long'}>
          <View className="gap-4">
            {picksAUnit ? (
              units.isLoading ? (
                <Loading />
              ) : (
                <InstancePicker
                  units={kindUnits}
                  value={unitId}
                  onChange={setUnitId}
                  label={isLagoon ? 'Which boat' : 'Which unit'}
                  caption={isLagoon ? seatsCaption(boatRooms) : undefined}
                  emptyMessage={
                    isLagoon
                      ? 'Every boat of this kind is full. Wait for one to come back, or pick another trip.'
                      : `No ${product?.name ?? 'unit'} is free at your desk right now.`
                  }
                  testID="rental-units"
                />
              )
            ) : null}

            <Card>
              <View className="flex-row items-center justify-between">
                <View className="min-w-0 flex-1">
                  <Label>{byDuration ? 'How long' : 'How many people'}</Label>
                  <Muted>
                    {byDuration
                      ? 'Hours'
                      : chosenUnit
                        ? `${seatsLeft} seat${seatsLeft === 1 ? '' : 's'} left on ${chosenUnit.identifier}`
                        : 'Riders or passengers'}
                  </Muted>
                </View>
                {byDuration ? (
                  <Stepper value={duration} onChange={setDuration} min={1} max={12} suffix="hours" testID="rental-duration" />
                ) : (
                  <Stepper
                    value={visitors}
                    onChange={setVisitors}
                    min={1}
                    max={picksAUnit ? Math.max(1, seatsLeft) : 12}
                    suffix="people"
                    testID="rental-visitors"
                  />
                )}
              </View>
            </Card>
          </View>
        </Section>
      ) : null}

      {step === 3 ? (
        <Section title="Take payment">
          {order.isLoading ? <Loading /> : <PaymentPanel order={order.data ?? null} state={payment} testID="rental-payment" />}
        </Section>
      ) : null}

      {step === 4 && booking ? (
        <Section title="Hand it over">
          <View className="gap-3">
            <Card>
              <View className="gap-1">
                <Label>Booking</Label>
                <Ref className="text-lg">{booking.ref}</Ref>
                <Muted>
                  {booking.productName}
                  {chosenUnit ? ` · ${chosenUnit.identifier}` : ''}
                </Muted>
              </View>
            </Card>

            {fulfilment ? (
              <>
                <Notice tone="warn">
                  <Body>
                    The clock starts when you confirm this, not when the customer paid. Tick it only once it is
                    actually done.
                  </Body>
                </Notice>
                <CheckRow
                  checked={acknowledged}
                  onChange={setAcknowledged}
                  title={fulfilment.prompt}
                  subtitle="The server refuses the handover without it."
                  testID="rental-ack"
                />
              </>
            ) : (
              <Notice tone="info">
                <Body>This activity has no handover step — the order is already on its way.</Body>
              </Notice>
            )}
          </View>
        </Section>
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
          disabled={!product}
          onPress={() => setStep(1)}
          testID="rental-next-product"
        />
      )
    }

    if (step === 1) {
      return (
        <Button
          label="Continue"
          size="lg"
          full
          disabled={!customer || !confirmed}
          onPress={() => setStep(2)}
          testID="rental-next-customer"
        />
      )
    }

    if (step === 2) {
      return (
        <Button
          label="Continue to payment"
          size="lg"
          full
          disabled={picksAUnit && !unitId}
          loading={create.isPending}
          onPress={startBooking}
          testID="rental-next-unit"
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
          loading={pay.isPending}
          onPress={confirmPayment}
          testID="rental-pay"
        />
      )
    }

    return fulfilment ? (
      <Button
        label={fulfilment.label}
        size="lg"
        full
        disabled={!acknowledged}
        loading={transition.isPending}
        icon={<Icon name="PackageCheck" size={18} color={COLORS.white} />}
        onPress={handOver}
        testID="rental-handover"
      />
    ) : (
      <Button
        label="Open the booking"
        size="lg"
        full
        onPress={() => booking && router.replace({ pathname: '/booking/[id]', params: { id: booking.id } })}
        testID="rental-open-booking"
      />
    )
  }
}
