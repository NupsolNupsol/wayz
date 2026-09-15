import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { apiMessage } from '@/api/client'
import {
  Button,
  Card,
  Field,
  Heading,
  Icon,
  Loading,
  Muted,
  Notice,
  Sheet,
  StepTrail,
  TextArea,
  Timeline,
  toast,
} from '@/design'
import { BagScanner } from '@/features/courier/components/BagScanner'
import { StopList } from '@/features/courier/components/StopList'
import { useCollectStop, useCourierTransition, useRun } from '@/features/courier/hooks'
import { DELIVERY_TRAIL, bagsInHand, meta, nextMove } from '@/features/courier/model'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { formatDateTime, relativeTime } from '@/lib/format'
import { COURIER_TABS, goToTab } from '@/lib/navigation'
import { COLORS, SHADOW, TONE_HEX } from '@/theme/tokens'

/**
 * One run, start to finish.
 *
 * The screen is a single column of "what now": the state at the top, the address you are walking
 * to, then exactly one action panel for the step you are on. Nothing else is offered, because a
 * courier reading this is usually walking.
 */
export default function RunScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { isTablet } = useDeviceClass()

  const { data, isLoading, refetch, isRefetching } = useRun(id)
  const run = useCourierTransition()
  const collect = useCollectStop()

  const [problemOpen, setProblemOpen] = useState(false)
  const [reason, setReason] = useState('')

  const fire = (code: string, payload?: { reason?: string; scannedBarcodes?: string[] }, success?: string) => {
    if (!id) return
    run.mutate(
      { id, code, payload },
      {
        onSuccess: () => success && toast('success', success),
        onError: (error) => toast('danger', 'Could not continue', apiMessage(error)),
      },
    )
  }

  if (isLoading || !data) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" testID="courier-run">
        <Loading label="Opening the run…" />
      </SafeAreaView>
    )
  }

  const d = data.delivery
  const m = meta(d.status)
  const hex = TONE_HEX[m.tone]
  const mine = data.mine !== false
  const claimed = !!d.assignedTo
  const stops = data.stops ?? d.stops ?? []
  const multiStop = stops.length > 1
  const activeStop = stops.find((s) => s.active) ?? null
  const carrying = bagsInHand({ delivery: d, bags: data.bags, stops })
  const phone = d.destination.contactPhone || d.customerPhone

  const call = () => {
    if (!phone) return
    void Linking.openURL(`tel:${phone}`)
  }

  const confirmCollected = (barcodes: string[]) => {
    if (!multiStop) {
      fire('TO_PICKED_UP', { scannedBarcodes: barcodes }, 'Bags collected')
      return
    }
    collect.mutate(
      { id: d._id, scannedBarcodes: barcodes },
      {
        onSuccess: (next) => {
          const pending = (next.stops ?? []).find((s) => s.status === 'PENDING')
          toast(
            'success',
            `Collected from ${activeStop?.kioskName ?? 'the desk'}`,
            pending ? `Next: ${pending.kioskName}` : 'That is every desk on this run.',
          )
        },
        onError: (error) => toast('danger', 'Could not collect', apiMessage(error)),
      },
    )
  }

  const busy = run.isPending || collect.isPending

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['left', 'right']} testID="courier-run">
      {/* A plain bar rather than the hero: on a run, the destination is the headline. */}
      <View
        className={`${isTablet ? 'px-8' : 'px-5'} flex-row items-center gap-3 border-b border-line bg-surface pb-3`}
        style={{ paddingTop: insets.top + 10 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => (router.canGoBack() ? router.back() : goToTab(COURIER_TABS.runs))}
          testID="run-back"
          className="h-10 w-10 items-center justify-center rounded-full bg-canvas active:opacity-70"
        >
          <Icon name="ArrowLeft" size={19} color={COLORS.navy} />
        </Pressable>
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-[16px] font-extrabold text-navy">
            {d.customerName}
          </Text>
          <Text numberOfLines={1} className="font-mono text-[11px] text-faint">
            {d._id}
          </Text>
        </View>
        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: `${hex}1a` }} testID="run-status">
          <Text className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: hex }}>
            {m.label}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.brand} colors={[COLORS.brand]} />
        }
      >
        <View className={`${isTablet ? 'px-8' : 'px-5'} gap-5 pt-5`}>
          {m.step >= 0 ? (
            <Card testID="run-trail">
              <StepTrail steps={DELIVERY_TRAIL} current={m.step} testID="run-steps" />
            </Card>
          ) : (
            <Notice tone={d.status === 'FAILED' ? 'danger' : 'warn'}>
              <Text className="text-[13px] font-semibold text-navy">{m.label}</Text>
              <Text className="mt-0.5 text-[13px] text-muted">{d.failureReason || m.hint}</Text>
            </Notice>
          )}

          {/* Where it is going. */}
          <View className="rounded-xl3 border border-line bg-surface p-4" style={SHADOW.card} testID="run-destination">
            <View className="flex-row items-start gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft">
                <Icon
                  name={d.destination.kind === 'GATE' || d.destination.kioskName ? 'DoorOpen' : 'MapPin'}
                  size={19}
                  color={COLORS.brandDark}
                />
              </View>
              <View className="min-w-0 flex-1">
                <Muted>Deliver to</Muted>
                <Text className="mt-0.5 text-[16px] font-bold leading-[21px] text-navy">{d.destination.address}</Text>
                {d.destination.notes ? (
                  <Text className="mt-1 text-[13px] leading-[18px] text-muted">{d.destination.notes}</Text>
                ) : null}
              </View>
            </View>

            {phone ? (
              <Button
                label={`Call ${phone}`}
                variant="secondary"
                full
                className="mt-3"
                icon={<Icon name="Phone" size={15} color={COLORS.navy} />}
                onPress={call}
                testID="run-call"
              />
            ) : null}
          </View>

          {multiStop ? <StopList stops={stops} testID="run-stops" /> : null}

          {/* Exactly one action panel, for the step in hand. */}
          <View className="gap-3">
            <Heading>What now</Heading>
            <View className="rounded-xl3 border border-line bg-surface p-4" style={SHADOW.card} testID="run-action">
              <Text className="text-[14px] leading-[19px] text-navy">{nextMove(d, activeStop?.kioskName)}</Text>

              {!mine ? (
                <Notice tone="warn" testID="run-not-mine">
                  <Text className="text-[13px] text-navy">
                    Another courier is on this one. You can watch it, but you cannot move it along.
                  </Text>
                </Notice>
              ) : null}

              {mine && !claimed ? (
                <Button
                  label="Take this run"
                  full
                  size="lg"
                  className="mt-4"
                  icon={<Icon name="Hand" size={17} color={COLORS.white} />}
                  loading={busy}
                  onPress={() => fire('TO_ASSIGNED', undefined, 'The run is yours')}
                  testID="run-claim"
                />
              ) : null}

              {mine && d.status === 'ASSIGNED' ? (
                <>
                  {multiStop ? (
                    <Text className="mt-2 text-[12px] font-bold text-brand-ink" testID="run-stop-progress">
                      Desk {stops.filter((s) => s.status === 'COLLECTED').length + 1} of {stops.length}
                    </Text>
                  ) : null}
                  <Button
                    label="Ask for the bags"
                    full
                    size="lg"
                    className="mt-4"
                    icon={<Icon name="Megaphone" size={17} color={COLORS.white} />}
                    loading={busy}
                    onPress={() => fire('TO_RELEASE_REQUESTED', undefined, 'The desk has been told you are there')}
                    testID="run-request"
                  />
                </>
              ) : null}

              {mine && d.status === 'RELEASE_REQUESTED' ? (
                <View className="mt-4 items-center gap-2 rounded-2xl bg-warn-soft px-4 py-6" testID="run-waiting">
                  <View className="h-12 w-12 items-center justify-center rounded-full bg-warn/15">
                    <Icon name="Hourglass" size={22} color={COLORS.warn} />
                  </View>
                  <Text className="text-[15px] font-bold text-navy">Waiting for the agent</Text>
                  <Text className="text-center text-[13px] text-muted">
                    Show them your name. They release the bags from their counter.
                  </Text>
                  <Text className="text-[11px] text-faint">Asked {relativeTime(d.releaseRequestedAt)}</Text>
                </View>
              ) : null}

              {mine && d.status === 'RELEASE_APPROVED' ? (
                <View className="mt-4 gap-3">
                  <View className="flex-row items-center gap-2 rounded-2xl bg-success-soft px-3 py-2.5">
                    <Icon name="CheckCheck" size={16} color={COLORS.success} />
                    <Text className="min-w-0 flex-1 text-[13px] font-semibold text-navy">
                      Released{d.assetUnitIdentifier ? ` from ${d.assetUnitIdentifier}` : ''} — scan them now.
                    </Text>
                  </View>
                  <BagScanner
                    bags={data.bags}
                    demoScanner={data.demoScanner}
                    pending={busy}
                    onConfirm={confirmCollected}
                  />
                </View>
              ) : null}

              {mine && d.status === 'PICKED_UP' ? (
                <View className="mt-4 gap-3">
                  <View className="flex-row items-center gap-2 rounded-2xl bg-info-soft px-3 py-2.5">
                    <Icon name="Truck" size={16} color={COLORS.info} />
                    <Text className="min-w-0 flex-1 text-[13px] font-semibold text-navy">
                      You are carrying {carrying} bag{carrying === 1 ? '' : 's'}
                      {multiStop ? ` from ${stops.length} desks` : ''}.
                    </Text>
                  </View>
                  <Button
                    label="Handed to the customer"
                    variant="success"
                    full
                    size="lg"
                    icon={<Icon name="PackageCheck" size={17} color={COLORS.white} />}
                    loading={busy}
                    onPress={() => fire('TO_DELIVERED', undefined, 'Delivered — nice work')}
                    testID="run-deliver"
                  />
                  <Button
                    label="Report a problem"
                    variant="ghost"
                    full
                    icon={<Icon name="AlertTriangle" size={16} color={COLORS.brandDark} />}
                    onPress={() => setProblemOpen(true)}
                    testID="run-problem"
                  />
                </View>
              ) : null}

              {['DELIVERED', 'FAILED', 'CANCELLED'].includes(d.status) ? (
                <View className="mt-4 items-center gap-2 py-4" testID="run-closed">
                  <View
                    className="h-14 w-14 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${hex}1a` }}
                  >
                    <Icon name={m.icon} size={24} color={hex} />
                  </View>
                  <Text className="text-[16px] font-extrabold text-navy">{m.label}</Text>
                  <Text className="text-center text-[13px] text-muted">{d.failureReason || m.hint}</Text>

                  {/* A closed run is a dead end otherwise: the tab bar is not on a pushed screen,
                      so the only way on would be the back arrow. */}
                  <View className="mt-3 w-full gap-2">
                    <Button
                      label="Back to my runs"
                      full
                      icon={<Icon name="Truck" size={16} color={COLORS.white} />}
                      onPress={() => goToTab(COURIER_TABS.runs)}
                      testID="run-back-to-runs"
                    />
                    <Button
                      label="Take another run"
                      variant="secondary"
                      full
                      icon={<Icon name="Hand" size={16} color={COLORS.navy} />}
                      onPress={() => goToTab(COURIER_TABS.board)}
                      testID="run-take-another"
                    />
                  </View>
                </View>
              ) : null}

              {mine && ['ASSIGNED', 'RELEASE_REQUESTED'].includes(d.status) ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setProblemOpen(true)}
                  testID="run-giveup"
                  className="mt-4 items-center py-1 active:opacity-60"
                >
                  <Text className="text-[12px] text-muted">I cannot do this run</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View className="gap-3">
            <Heading>What has happened</Heading>
            <Card testID="run-timeline">
              <Timeline
                entries={d.timeline.map((entry, i) => ({
                  key: `${entry.at}-${i}`,
                  title: meta(entry.status).label,
                  note: entry.note,
                  at: formatDateTime(entry.at),
                  tone: meta(entry.status).tone,
                }))}
              />
            </Card>
          </View>
        </View>
      </ScrollView>

      <Sheet
        open={problemOpen}
        onClose={() => {
          setProblemOpen(false)
          setReason('')
        }}
        title={d.status === 'PICKED_UP' ? 'Report a problem' : 'Give the run back'}
        subtitle={
          d.status === 'PICKED_UP'
            ? 'You are holding the bags — say what happened so the desk can act on it.'
            : 'It goes back on the board for another courier.'
        }
        testID="run-problem-sheet"
        footer={
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button
                label="Back"
                variant="secondary"
                full
                onPress={() => {
                  setProblemOpen(false)
                  setReason('')
                }}
              />
            </View>
            <View className="flex-1">
              <Button
                label="Submit"
                variant="danger"
                full
                disabled={reason.trim().length < 3}
                loading={busy}
                onPress={() => {
                  fire(d.status === 'PICKED_UP' ? 'TO_FAILED' : 'TO_CANCELLED', { reason: reason.trim() }, 'Recorded')
                  setProblemOpen(false)
                  setReason('')
                }}
                testID="run-problem-submit"
              />
            </View>
          </View>
        }
      >
        <Field label="What happened" required hint="This is kept on the run for the desk and the audit trail.">
          <TextArea
            value={reason}
            onChangeText={setReason}
            placeholder="Nobody at the gate, customer not answering…"
            testID="run-problem-reason"
          />
        </Field>
      </Sheet>
    </SafeAreaView>
  )
}
