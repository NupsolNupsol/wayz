import { useMemo, useState } from 'react'
import { View } from 'react-native'

import { apiMessage } from '@/api/client'
import { Icon } from '@/components/Icon'
import { ScanField } from '@/components/ScanField'
import { Body, Button, Field, Meter, Muted, Notice, Ref, Sheet, toast } from '@/components/ui'
import { useTransition } from '@/hooks/queries'
import { COLORS } from '@/theme/tokens'
import type { Booking } from '@/types'

export function StoreSheet({
  open,
  onClose,
  booking,
  unitIdentifier,
}: {
  open: boolean
  onClose: () => void
  booking: Booking
  unitIdentifier: string | null
}) {
  const transition = useTransition()
  const [unitScan, setUnitScan] = useState('')
  const [entry, setEntry] = useState('')
  const [scanned, setScanned] = useState<string[]>([])

  const expected = useMemo(() => booking.bags.map((b) => b.barcode), [booking.bags])
  const unitDone = !!unitIdentifier && unitScan.trim().toUpperCase() === unitIdentifier.toUpperCase()
  const allBags = expected.length > 0 && expected.every((code) => scanned.includes(code))
  const ready = unitDone && allBags

  const takeBag = (code: string) => {
    const clean = code.trim()
    if (!clean) return
    setEntry('')

    if (!expected.includes(clean)) {
      toast('danger', 'Not a bag on this booking', `${clean} belongs somewhere else.`)
      return
    }
    if (scanned.includes(clean)) {
      toast('warn', 'Already scanned', 'Each bag counts once.')
      return
    }
    setScanned((prev) => [...prev, clean])
  }

  const confirm = () => {
    if (!booking.reservation?.assetUnitId) return
    transition.mutate(
      {
        id: booking.id,
        code: 'TO_STORED',
        payload: {
          scannedUnitId: booking.reservation.assetUnitId,
          scannedBarcodes: scanned,
          durationMin: booking.session.requestedDurationMin,
        },
      },
      {
        onSuccess: () => {
          toast('success', 'Storage confirmed', 'The timer is running now.')
          setUnitScan('')
          setScanned([])
          onClose()
        },
        onError: (e) => toast('danger', 'Cannot confirm storage', apiMessage(e)),
      },
    )
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Scan in & confirm storage"
      subtitle="The timer starts here, never at payment."
      testID="store-sheet"
      footer={
        <Button
          label={ready ? 'Confirm storage' : `Scan ${unitDone ? '' : 'the compartment and '}every bag`}
          size="lg"
          full
          disabled={!ready}
          loading={transition.isPending}
          onPress={confirm}
          testID="store-confirm"
        />
      }
    >
      <Field label="Compartment" hint={unitIdentifier ? `Reserved: ${unitIdentifier}` : 'No compartment reserved yet'}>
        <ScanField
          value={unitScan}
          onChangeText={setUnitScan}
          onSubmit={setUnitScan}
          placeholder="Scan the compartment label"
          testID="store-unit-scan"
        />
      </Field>

      {unitDone ? (
        <Notice tone="success" testID="store-unit-ok">
          <View className="flex-row items-center gap-2">
            <Icon name="Check" size={16} color={COLORS.success} />
            <Body className="font-semibold">Compartment matched</Body>
          </View>
        </Notice>
      ) : null}

      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Body className="font-semibold">
            Bags {scanned.length} of {expected.length}
          </Body>
          <Muted>{allBags ? 'All in' : 'Scan each one'}</Muted>
        </View>
        <Meter value={scanned.length} max={expected.length} tone={allBags ? 'success' : 'brand'} testID="store-progress" />
      </View>

      <ScanField
        value={entry}
        onChangeText={setEntry}
        onSubmit={takeBag}
        placeholder="Scan a bag barcode"
        testID="store-bag-scan"
      />

      <View className="gap-2">
        {booking.bags.map((bag) => {
          const done = scanned.includes(bag.barcode)
          return (
            <View
              key={bag.barcode}
              testID={`store-bag-${bag.index}`}
              className={`flex-row items-center gap-3 rounded-2xl border p-3 ${
                done ? 'border-success/40 bg-success-soft' : 'border-line bg-surface'
              }`}
            >
              <View
                className={`h-8 w-8 items-center justify-center rounded-xl ${done ? 'bg-success' : 'bg-canvas'}`}
              >
                {done ? (
                  <Icon name="Check" size={15} color={COLORS.white} strokeWidth={3} />
                ) : (
                  <Body className="text-[12px] font-bold text-muted">{bag.index}</Body>
                )}
              </View>
              <View className="min-w-0 flex-1">
                <Body className="font-semibold" numberOfLines={1}>
                  {bag.description || `Bag ${bag.index}`}
                </Body>
                <Ref className="text-[12px] text-muted">{bag.barcode}</Ref>
              </View>
              {!done ? (
                <Body
                  className="font-semibold text-brand-ink"
                  onPress={() => takeBag(bag.barcode)}
                  testID={`store-bag-tap-${bag.index}`}
                >
                  Scan
                </Body>
              ) : null}
            </View>
          )
        })}
      </View>
    </Sheet>
  )
}
