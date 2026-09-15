import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { apiMessage } from '@/api/client'
import {
  Amount,
  Body,
  Button,
  Card,
  EmptyState,
  Heading,
  Icon,
  KeyValue,
  Loading,
  Meter,
  Muted,
  Notice,
  Ref,
  ScanField,
  Screen,
  ScreenHeader,
  Section,
  StatusPill,
  toast,
} from '@/design'
import { engineLabel } from '@/config/engines'
import { StoreSheet } from '@/features/booking/StoreSheet'
import { VerifySheet } from '@/features/booking/VerifySheet'
import { useBooking, useOrder, useScanOut, useTransition, useTransitions, useUnits } from '@/hooks/queries'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { useNow } from '@/hooks/useNow'
import { formatDateTime, humanizeMs, money } from '@/lib/format'
import { KIOSK_TABS } from '@/lib/navigation'
import { COLORS } from '@/theme/tokens'

/**
 * One booking, and everything the counter can do to it.
 *
 * The clock is the headline because it is what the customer asks about, and the available actions
 * come from the server rather than from a guess here — a state machine the app second-guesses is a
 * state machine that offers a button the server then refuses.
 */
export default function BookingConsole() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { isDesk } = useDeviceClass()
  const now = useNow()

  const booking = useBooking(id)
  const order = useOrder(id)
  const transitions = useTransitions(id)
  const units = useUnits()
  const transition = useTransition()
  const scanOut = useScanOut()

  const [storeOpen, setStoreOpen] = useState(false)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [barcode, setBarcode] = useState('')

  const b = booking.data

  const header = (
    <ScreenHeader
      title={b?.ref ?? 'Booking'}
      subtitle={b ? `${b.productName}${b.customerName ? ` · ${b.customerName}` : ''}` : undefined}
      fallback={KIOSK_TABS.operations}
      right={b ? <StatusPill status={b.status} /> : undefined}
    />
  )

  if (booking.isLoading) {
    return (
      <Screen testID="booking" header={header}>
        <Loading />
      </Screen>
    )
  }

  if (!b) {
    return (
      <Screen testID="booking" header={header}>
        <EmptyState title="Booking not found" message="It may belong to another station." />
      </Screen>
    )
  }

  const fresh = b.verifications.some(
    (v) => v.purpose === 'RETRIEVAL' && v.status === 'VERIFIED' && new Date(v.expiresAt).getTime() > now,
  )
  const available = transitions.data?.transitions ?? []
  const canRetrieve = available.some((t) => t.code === 'TO_RETRIEVAL')
  const inRetrieval = b.status === 'RETRIEVAL_IN_PROGRESS'
  const reservedUnit = units.data?.find((u) => u._id === (b.reservation?.assetUnitId ?? b.assetUnitId))
  const bagsOut = b.bags.filter((bag) => bag.status === 'RETRIEVED' || bag.status === 'DELIVERED').length

  const run = (code: string, label: string) => {
    if (code === 'TO_STORED') {
      setStoreOpen(true)
      return
    }
    if (code === 'TO_RETRIEVAL' && !fresh) {
      setVerifyOpen(true)
      return
    }
    transition.mutate(
      {
        id: b.id,
        code,
        payload:
          code === 'TO_HANDOVER'
            ? { inspectionDone: true, durationMin: b.session.requestedDurationMin }
            : code === 'TO_STARTED'
              ? { safetyAck: true, boardingVerified: true }
              : {},
      },
      {
        onSuccess: () => toast('success', `${label} ✓`),
        onError: (e) => toast('danger', 'Action blocked', apiMessage(e)),
      },
    )
  }

  const takeOut = (value: string) => {
    const clean = value.trim()
    if (!clean) return
    scanOut.mutate(
      { id: b.id, barcode: clean },
      {
        onSuccess: () => {
          setBarcode('')
          toast('success', 'Bag scanned out')
        },
        onError: (e) => toast('danger', 'Scan rejected', apiMessage(e)),
      },
    )
  }

  const remaining = b.session.remainingMs
  const late = b.session.isOvertime

  return (
    <Screen
      scroll
      onRefresh={() => void booking.refetch()}
      refreshing={booking.isFetching}
      testID="booking"
      header={header}
    >
      <View className={isDesk ? 'flex-row gap-4' : 'gap-4'}>
        <View className={isDesk ? 'flex-1 gap-4' : 'gap-4'}>
          {b.session.startedAt ? (
            <Card testID="booking-timer">
              <View className="items-center gap-1 py-2">
                <Muted>{late ? 'Past the end time by' : 'Time remaining'}</Muted>
                <Amount className={`text-4xl ${late ? 'text-danger' : 'text-navy'}`}>
                  {remaining === null ? '—' : humanizeMs(Math.abs(remaining))}
                </Amount>
                <Muted>ends {formatDateTime(b.session.expectedEndAt)}</Muted>
              </View>
            </Card>
          ) : (
            <Notice tone="warn" testID="booking-not-started">
              <Body>The timer has not started. It begins when the bags are scanned in, never at payment.</Body>
            </Notice>
          )}

          {canRetrieve && !fresh ? (
            <Notice tone="info" testID="booking-verify-required">
              <View className="gap-3">
                <Body className="font-semibold">Retrieval is locked until the customer is verified.</Body>
                <Button label="Verify the customer" onPress={() => setVerifyOpen(true)} testID="booking-verify-open" />
              </View>
            </Notice>
          ) : null}

          {canRetrieve && fresh ? (
            <Notice tone="success" testID="booking-verified">
              <View className="flex-row items-center gap-2">
                <Icon name="ShieldCheck" size={16} color={COLORS.success} />
                <Body className="font-semibold">Identity verified — retrieval authorised.</Body>
              </View>
            </Notice>
          ) : null}

          <Section title="What happens next">
            {available.length === 0 ? (
              <Card>
                <Muted>No actions are available in this state.</Muted>
              </Card>
            ) : (
              <View className="gap-2">
                {available.map((t) => (
                  <Button
                    key={t.code}
                    label={t.label}
                    size="lg"
                    full
                    loading={transition.isPending}
                    onPress={() => run(t.code, t.label)}
                    testID={`action-${t.code}`}
                  />
                ))}
              </View>
            )}
          </Section>

          {b.bags.length > 0 ? (
            <Section title={`Bags (${b.bags.length})`}>
              <Card>
                {inRetrieval ? (
                  <View className="mb-3 gap-2">
                    <Meter value={bagsOut} max={b.bags.length} tone={bagsOut === b.bags.length ? 'success' : 'brand'} />
                    <Muted>
                      {bagsOut} of {b.bags.length} handed back
                    </Muted>
                    <ScanField
                      value={barcode}
                      onChangeText={setBarcode}
                      onSubmit={takeOut}
                      placeholder="Scan a bag as you hand it over"
                      testID="booking-scan-out"
                    />
                  </View>
                ) : null}

                <View className="gap-2">
                  {b.bags.map((bag) => {
                    const out = bag.status === 'RETRIEVED' || bag.status === 'DELIVERED'
                    return (
                      <View
                        key={bag.barcode}
                        className="flex-row items-center gap-3 rounded-2xl border border-line p-3"
                        testID={`bag-${bag.index}`}
                      >
                        <View className="min-w-0 flex-1 gap-0.5">
                          <Body className="font-semibold" numberOfLines={1}>
                            {bag.description || `Bag ${bag.index}`}
                          </Body>
                          <Ref className="text-[12px] text-muted">{bag.barcode}</Ref>
                        </View>
                        <StatusPill status={bag.status} size="sm" />
                        {inRetrieval && !out ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Scan out ${bag.description || `bag ${bag.index}`}`}
                            onPress={() => takeOut(bag.barcode)}
                            testID={`bag-scan-${bag.index}`}
                            className="rounded-xl bg-brand px-3 py-2 active:opacity-80"
                          >
                            <Body className="text-[13px] font-semibold text-white">Scan</Body>
                          </Pressable>
                        ) : null}
                      </View>
                    )
                  })}
                </View>
              </Card>
            </Section>
          ) : null}
        </View>

        <View className={isDesk ? 'w-[360px] gap-4' : 'gap-4'}>
          <Card title="Session">
            <View className="flex-row flex-wrap gap-4">
              <KeyValue label="Activity" value={engineLabel(b.engineKind)} className="min-w-[45%]" />
              <KeyValue label="Unit" value={reservedUnit?.identifier ?? '—'} className="min-w-[45%]" />
              <KeyValue label="Started" value={formatDateTime(b.session.startedAt)} className="min-w-[45%]" />
              <KeyValue label="Expected end" value={formatDateTime(b.session.expectedEndAt)} className="min-w-[45%]" />
            </View>
          </Card>

          <Card title="Customer">
            <View className="gap-2">
              <Body className="text-base font-semibold">{b.customerName || '—'}</Body>
              <View className="flex-row items-center gap-2">
                <Icon name="Phone" size={14} color={COLORS.faint} />
                <Muted>{b.customerPhone || '—'}</Muted>
              </View>
            </View>
          </Card>

          {order.data ? (
            <Card title="Money" testID="booking-order">
              <View className="gap-1.5">
                {order.data.lines.map((line, index) => (
                  <View key={`${line.name}-${index}`} className="flex-row justify-between gap-3">
                    <Muted className="flex-1" numberOfLines={1}>
                      {line.name}
                      {line.isDeposit ? ' (deposit)' : ''}
                    </Muted>
                    <Muted>{money(line.unitPrice * line.quantity)}</Muted>
                  </View>
                ))}
                <View className="mt-1 flex-row justify-between border-t border-line pt-2">
                  <Body className="font-bold">Total</Body>
                  <Amount>{money(order.data.total)}</Amount>
                </View>
                {order.data.balanceDue > 0 ? (
                  <View className="flex-row justify-between">
                    <Body className="font-semibold text-danger">Still due</Body>
                    <Amount className="text-danger">{money(order.data.balanceDue)}</Amount>
                  </View>
                ) : null}
              </View>
            </Card>
          ) : null}

          {b.custody.length > 0 ? (
            <Card title="Custody">
              <View className="gap-3">
                {b.custody.map((event, index) => (
                  <View key={index} className="gap-0.5">
                    <Heading className="text-[14px]">
                      {event.from} → {event.to}
                    </Heading>
                    <Muted>
                      {event.note ? `${event.note} · ` : ''}
                      {formatDateTime(event.at)}
                    </Muted>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}
        </View>
      </View>

      <StoreSheet
        open={storeOpen}
        onClose={() => setStoreOpen(false)}
        booking={b}
        unitIdentifier={reservedUnit?.identifier ?? null}
      />

      <VerifySheet
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        booking={b}
        onVerified={() => run('TO_RETRIEVAL', 'Begin retrieval')}
      />
    </Screen>
  )
}
