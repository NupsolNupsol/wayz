import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { apiMessage } from '@/api/client'
import {
  Button,
  EmptyState,
  Field,
  FeatureCard,
  Heading,
  Icon,
  InfoRows,
  Input,
  Loading,
  MiniStat,
  Muted,
  Notice,
  ScreenHeader,
  StatusPill,
  StatTile,
  toast,
} from '@/design'
import { useBlindCount, useOpenShift, useShift } from '@/hooks/queries'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { formatDateTime, money } from '@/lib/format'
import { COLORS, SHADOW } from '@/theme/tokens'

/**
 * The drawer.
 *
 * Counting is blind on purpose: the agent types what is physically in the till before the platform
 * says what it expected, so the count is a count and not a confirmation.
 */
export default function ShiftScreen() {
  const { isTablet } = useDeviceClass()
  const shift = useShift()
  const open = useOpenShift()
  const count = useBlindCount()

  const [counted, setCounted] = useState('')

  const s = shift.data
  const isOpen = s?.status === 'OPEN'
  const isCounted = s?.status === 'COUNTED' || s?.countedCash !== null

  const submitCount = () => {
    if (!s) return
    const value = Number(counted.replace(',', '.'))
    if (!Number.isFinite(value) || value < 0) {
      toast('warn', 'That is not an amount', 'Type what is in the drawer.')
      return
    }
    count.mutate(
      { id: s._id, countedCash: value },
      {
        onSuccess: (next) => {
          const variance = next.variance ?? 0
          toast(
            variance === 0 ? 'success' : 'warn',
            variance === 0 ? 'It balances' : `Off by ${money(Math.abs(variance))}`,
            variance === 0 ? 'Nothing to explain.' : 'A supervisor settles the difference.',
          )
          setCounted('')
        },
        onError: (error) => toast('danger', 'Could not record the count', apiMessage(error)),
      },
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['left', 'right']} testID="kiosk-shift">
      <ScreenHeader
        title="Till & cash"
        subtitle={isOpen ? 'Open — money can be taken' : 'Closed'}
        fallback="/(kiosk)/more"
        right={s ? <StatusPill status={s.status} size="sm" /> : undefined}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View className={`${isTablet ? 'px-8' : 'px-5'} gap-6 pt-5`}>
          {shift.isLoading && !s ? (
            <Loading />
          ) : !s || s.status === 'CLOSED' ? (
            <>
              <EmptyState
                icon={<Icon name="Wallet" size={26} color={COLORS.faint} />}
                title="No open till"
                message="Nothing can be sold or settled until a drawer is open. The platform counts expected cash against it, so without one the day cannot balance."
                testID="shift-none"
              />
              <Button
                label="Open my till"
                full
                size="lg"
                icon={<Icon name="Wallet" size={17} color={COLORS.white} />}
                loading={open.isPending}
                onPress={() =>
                  open.mutate(undefined, {
                    onSuccess: () => toast('success', 'Till open', 'You can take money now.'),
                    onError: (error) => toast('danger', 'Could not open it', apiMessage(error)),
                  })
                }
                testID="shift-open"
              />
            </>
          ) : (
            <>
              <View className="flex-row gap-3">
                <StatTile
                  icon="Banknote"
                  gradient="navy"
                  label="Expected in the drawer"
                  value={money(s.expectedCash)}
                  caption={`Opened ${formatDateTime(s.openedAt)}`}
                  testID="shift-expected"
                />
                <StatTile
                  icon="CircleDollarSign"
                  gradient={s.variance === null ? 'brand' : s.variance === 0 ? 'brand' : 'slate'}
                  label="Counted"
                  value={s.countedCash === null ? '—' : money(s.countedCash)}
                  caption={s.variance === null ? 'Not counted yet' : s.variance === 0 ? 'Balances' : `Off by ${money(Math.abs(s.variance))}`}
                  testID="shift-counted"
                />
              </View>

              <View className="gap-3">
                <Heading>This shift</Heading>
                <View className="rounded-xl3 border border-line bg-surface p-4" style={SHADOW.card}>
                  <InfoRows
                    testID="shift-rows"
                    rows={[
                      { label: 'State', value: <StatusPill status={s.status} size="sm" /> },
                      { label: 'Opened', value: formatDateTime(s.openedAt) },
                      { label: 'Expected', value: money(s.expectedCash) },
                      { label: 'Counted', value: s.countedCash === null ? 'Not yet' : money(s.countedCash) },
                      {
                        label: 'Difference',
                        value: s.variance === null ? '—' : money(s.variance),
                      },
                    ]}
                  />
                </View>
              </View>

              {!isCounted ? (
                <View className="gap-3">
                  <Heading>Count the drawer</Heading>
                  <View className="gap-3 rounded-xl3 border border-line bg-surface p-4" style={SHADOW.card}>
                    <Notice tone="info">
                      <Text className="text-[13px] leading-[18px] text-navy">
                        Count what is actually in the till and type it below. You are not shown the expected figure
                        first — that is what makes it a count.
                      </Text>
                    </Notice>
                    <Field label="Cash counted" hint="Notes and coins, to the halala.">
                      <Input
                        value={counted}
                        onChangeText={setCounted}
                        placeholder="0.00"
                        keyboardType="decimal-pad"
                        inputMode="decimal"
                        testID="shift-counted-input"
                      />
                    </Field>
                    <Button
                      label="Record the count"
                      full
                      size="lg"
                      icon={<Icon name="Check" size={17} color={COLORS.white} />}
                      loading={count.isPending}
                      disabled={!counted.trim()}
                      onPress={submitCount}
                      testID="shift-count-submit"
                    />
                  </View>
                </View>
              ) : s.variance !== null && s.variance !== 0 ? (
                <FeatureCard
                  icon="AlertTriangle"
                  gradient="slate"
                  title={`The drawer is out by ${money(Math.abs(s.variance))}`}
                  message="A supervisor settles a difference — it cannot be written off from the counter."
                  testID="shift-variance"
                />
              ) : (
                <FeatureCard
                  icon="CheckCheck"
                  gradient="brand"
                  title="It balances"
                  message="Counted and agreed. Nothing left to explain on this shift."
                  testID="shift-balanced"
                />
              )}

              <View className="flex-row gap-3">
                <MiniStat icon="Clock" label="Opened" value={formatDateTime(s.openedAt).split(' ')[1] ?? '—'} tone="info" />
                <MiniStat icon="Wallet" label="Expected" value={money(s.expectedCash)} tone="brand" />
                <MiniStat
                  icon="TrendingUp"
                  label="Difference"
                  value={s.variance === null ? '—' : money(s.variance)}
                  tone={s.variance ? 'danger' : 'success'}
                />
              </View>

              <Muted>
                The till belongs to you for this shift. A supervisor can force it closed if it is left open.
              </Muted>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
