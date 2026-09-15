import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { Button, Icon, Input, Notice, toast } from '@/design'
import { COLORS, SHADOW } from '@/theme/tokens'

import type { DeliveryBag } from '../types'

/**
 * Every bag gets scanned as it leaves the desk.
 *
 * The count is blind on purpose: the courier scans what is handed to them and the platform decides
 * whether those codes belong to this customer. A courier who could see the expected barcodes could
 * confirm a bag they were never given.
 */
export function BagScanner({
  bags,
  demoScanner,
  pending,
  onConfirm,
  testID,
}: {
  bags: DeliveryBag[]
  demoScanner: boolean
  pending: boolean
  onConfirm: (barcodes: string[]) => void
  testID?: string
}) {
  const [scans, setScans] = useState<string[]>([])
  const [entry, setEntry] = useState('')

  const add = (raw: string) => {
    const code = raw.trim().toUpperCase()
    if (!code) return
    if (scans.includes(code)) {
      toast('warn', 'Already scanned', 'Each bag counts once.')
      setEntry('')
      return
    }
    setScans((current) => [...current, code])
    setEntry('')
  }

  const remove = (code: string) => setScans((current) => current.filter((c) => c !== code))

  // Without a real barcode the row cannot be matched by code, so it fills in scan order.
  const rowDone = (bag: DeliveryBag, index: number) =>
    bag.demoScan ? scans.includes(bag.demoScan) : index < scans.length

  const complete = scans.length === bags.length && bags.length > 0

  return (
    <View className="gap-3" testID={testID ?? 'bag-scanner'}>
      <Notice tone="info">
        <Text className="text-[13px] leading-[18px] text-navy">
          Scan every bag as you take it out. The desk knows which codes belong to this customer — a
          code that does not match is refused.
        </Text>
      </Notice>

      <View className="gap-2">
        {bags.map((bag, index) => {
          const done = rowDone(bag, index)
          return (
            <View
              key={bag.index}
              className={`flex-row items-center gap-3 rounded-2xl border p-3 ${
                done ? 'border-success/40 bg-success-soft' : 'border-line bg-surface'
              }`}
              testID={`bag-slot-${bag.index}`}
            >
              <View
                className={`h-9 w-9 items-center justify-center rounded-xl ${done ? 'bg-success/15' : 'bg-canvas'}`}
              >
                <Icon
                  name={done ? 'Check' : 'Package'}
                  size={16}
                  color={done ? COLORS.success : COLORS.faint}
                  strokeWidth={2.4}
                />
              </View>

              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="text-[14px] font-semibold text-navy">
                  Bag {bag.index}
                </Text>
                <Text numberOfLines={1} className="text-[12px] text-muted">
                  {bag.description || 'Customer bag'}
                </Text>
              </View>

              {done ? (
                <Text className="text-[12px] font-bold text-success">Scanned</Text>
              ) : bag.demoScan ? (
                <Button
                  label="Scan"
                  size="sm"
                  variant="secondary"
                  icon={<Icon name="ScanLine" size={14} color={COLORS.navy} />}
                  onPress={() => add(bag.demoScan!)}
                  testID={`bag-scan-${bag.index}`}
                />
              ) : (
                <Text className="text-[12px] text-faint">Waiting</Text>
              )}
            </View>
          )
        })}
      </View>

      {demoScanner ? (
        <Button
          label="Scan them all"
          variant="ghost"
          full
          icon={<Icon name="Zap" size={15} color={COLORS.brandDark} />}
          disabled={complete}
          onPress={() => bags.forEach((bag) => bag.demoScan && !scans.includes(bag.demoScan) && add(bag.demoScan))}
          testID="bag-scan-all"
        />
      ) : null}

      <View className="flex-row items-end gap-2">
        <View className="flex-1">
          <Input
            value={entry}
            onChangeText={setEntry}
            placeholder="Type or scan a barcode"
            autoCapitalize="characters"
            onSubmitEditing={() => add(entry)}
            testID="bag-scan-input"
          />
        </View>
        <Button label="Add" variant="secondary" disabled={!entry.trim()} onPress={() => add(entry)} testID="bag-scan-add" />
      </View>

      {scans.length > 0 ? (
        <View className="flex-row flex-wrap gap-1.5" testID="bag-scan-list">
          {scans.map((code) => (
            <Pressable
              key={code}
              accessibilityRole="button"
              accessibilityLabel={`Remove scan ${code}`}
              onPress={() => remove(code)}
              className="flex-row items-center gap-1.5 rounded-full bg-info-soft px-2.5 py-1 active:opacity-70"
            >
              <Text className="font-mono text-[11px] font-bold text-info">{code}</Text>
              <Icon name="X" size={11} color={COLORS.info} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <View className="flex-row items-center justify-between rounded-2xl bg-canvas px-3 py-2" style={SHADOW.card}>
        <Text className="text-[13px] text-muted">Scanned</Text>
        <Text className="text-[15px] font-extrabold text-navy" style={{ fontVariant: ['tabular-nums'] }}>
          {scans.length} / {bags.length}
        </Text>
      </View>

      <Button
        label="Confirm collected"
        full
        size="lg"
        icon={<Icon name="PackageCheck" size={17} color={COLORS.white} />}
        disabled={!complete}
        loading={pending}
        onPress={() => onConfirm(scans)}
        testID="bag-confirm"
      />
    </View>
  )
}
