import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Button, EmptyState, Hero, Heading, Icon, Input, Loading, Muted, Notice, toast } from '@/design'
import { useSession } from '@/features/auth/hooks'
import { RunCard } from '@/features/courier/components/RunCard'
import { useCourierBoard } from '@/features/courier/hooks'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { initialsOf } from '@/lib/workspace'
import { COLORS, SHADOW } from '@/theme/tokens'

/**
 * The raised middle button.
 *
 * A courier reaches for this holding a bag: it jumps straight to the run that is ready to be
 * scanned, and if more than one is ready it asks which. The reference field underneath is the
 * fallback for a paper slip with no run open on the phone.
 */
export default function ScanScreen() {
  const router = useRouter()
  const { me } = useSession()
  const { isTablet } = useDeviceClass()
  const { data, isLoading } = useCourierBoard()
  const [reference, setReference] = useState('')

  const mine = data?.mine ?? []
  const ready = useMemo(() => mine.filter((r) => r.status === 'RELEASE_APPROVED'), [mine])
  const waiting = useMemo(() => mine.filter((r) => r.status === 'RELEASE_REQUESTED'), [mine])

  const lookup = () => {
    const value = reference.trim().toUpperCase()
    if (!value) return
    const all = [...mine, ...(data?.available ?? [])]
    const hit = all.find(
      (r) => r._id.toUpperCase() === value || r.bookingRef?.toUpperCase() === value,
    )
    if (!hit) {
      toast('warn', 'No run with that reference', 'Check the slip, or find it on the board.')
      return
    }
    setReference('')
    router.push(`/(courier)/run/${hit._id}` as never)
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['left', 'right']} testID="courier-scan">
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <Hero
          gradient="courier"
          initials={initialsOf(me)}
          name="Scan bags"
          subtitle="Open the run you are collecting"
          bleed={20}
          testID="scan-hero"
        />

        <View className={`${isTablet ? 'px-8' : 'px-5'} -mt-3 gap-5`}>
          {isLoading ? (
            <Loading />
          ) : (
            <>
              {ready.length > 0 ? (
                <View className="gap-3">
                  <Heading>{ready.length === 1 ? 'Ready to scan' : 'Ready to scan'}</Heading>
                  {ready.map((r) => (
                    <RunCard
                      key={r._id}
                      run={r}
                      highlight
                      onPress={() => router.push(`/(courier)/run/${r._id}` as never)}
                      action={
                        <Button
                          label="Scan these bags"
                          full
                          icon={<Icon name="ScanLine" size={16} color={COLORS.white} />}
                          onPress={() => router.push(`/(courier)/run/${r._id}` as never)}
                          testID={`scan-open-${r._id}`}
                        />
                      }
                    />
                  ))}
                </View>
              ) : waiting.length > 0 ? (
                <Notice tone="warn" testID="scan-waiting">
                  <Text className="text-[13px] font-semibold text-navy">
                    {waiting.length === 1 ? 'A desk is checking you in' : `${waiting.length} desks are checking you in`}
                  </Text>
                  <Text className="mt-0.5 text-[13px] text-muted">
                    Once the agent releases the bags, the run appears here to scan.
                  </Text>
                </Notice>
              ) : (
                <EmptyState
                  icon={<Icon name="ScanLine" size={26} color={COLORS.faint} />}
                  title="Nothing to scan yet"
                  message="Take a run, walk to the desk, and ask the agent for the bags. Scanning opens here."
                  action={<Button label="Open the board" onPress={() => router.push('/(courier)/board' as never)} testID="scan-goto-board" />}
                  testID="scan-empty"
                />
              )}

              <View className="gap-2 rounded-xl3 border border-line bg-surface p-4" style={SHADOW.card}>
                <Heading>Have a reference?</Heading>
                <Muted>Type the run or booking reference from the slip and it opens straight away.</Muted>
                <View className="mt-1 flex-row gap-2">
                  <View className="flex-1">
                    <Input
                      value={reference}
                      onChangeText={setReference}
                      placeholder="dlv-0001 or BK-0001"
                      autoCapitalize="characters"
                      onSubmitEditing={lookup}
                      testID="scan-reference"
                    />
                  </View>
                  <Button label="Open" variant="secondary" disabled={!reference.trim()} onPress={lookup} testID="scan-lookup" />
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
