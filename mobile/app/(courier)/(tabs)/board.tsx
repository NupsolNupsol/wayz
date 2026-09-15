import { useRouter } from 'expo-router'
import { useState } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { apiMessage } from '@/api/client'
import { Button, EmptyState, Hero, HeroChip, Heading, Icon, Loading, Muted, Segmented, toast } from '@/design'
import { useSession } from '@/features/auth/hooks'
import { RunCard } from '@/features/courier/components/RunCard'
import { useCourierBoard, useCourierTransition } from '@/features/courier/hooks'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { initialsOf } from '@/lib/workspace'
import { COLORS } from '@/theme/tokens'

type Filter = 'open' | 'mine'

/**
 * The shared board: everything going spare at this site, and everything already in my hands.
 *
 * Claiming is deliberately a two-tap action from here — one to take it, and the app then opens the
 * run so the courier is looking at the desk they have to walk to.
 */
export default function BoardScreen() {
  const router = useRouter()
  const { me } = useSession()
  const { isTablet } = useDeviceClass()
  const { data, isLoading, refetch, isRefetching } = useCourierBoard()
  const claim = useCourierTransition()
  const [filter, setFilter] = useState<Filter>('open')

  const available = data?.available ?? []
  const mine = data?.mine ?? []
  const rows = filter === 'open' ? available : mine

  const take = (id: string) => {
    claim.mutate(
      { id, code: 'TO_ASSIGNED' },
      {
        onSuccess: () => {
          toast('success', 'The run is yours', 'Head to the desk and ask for the bags.')
          router.push(`/(courier)/run/${id}` as never)
        },
        onError: (error) => toast('danger', 'Could not take it', apiMessage(error, 'Someone may have got there first.')),
      },
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['left', 'right']} testID="courier-board">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.brand} colors={[COLORS.brand]} />
        }
      >
        <Hero
          gradient="courier"
          initials={initialsOf(me)}
          name="Run board"
          subtitle={me?.station?.name ?? 'Everything going spare at your site'}
          right={<HeroChip icon="Hand" label={`${available.length} open`} testID="board-open-chip" />}
          bleed={20}
          testID="board-hero"
        />

        <View className={`${isTablet ? 'px-8' : 'px-5'} -mt-3 gap-5`}>
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'open', label: 'Open', count: available.length },
              { value: 'mine', label: 'Mine', count: mine.length },
            ]}
            testID="board-filter"
          />

          {isLoading ? (
            <Loading label="Reading the board…" />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Icon name={filter === 'open' ? 'PackageCheck' : 'Truck'} size={26} color={COLORS.faint} />}
              title={filter === 'open' ? 'Board is clear' : 'Nothing in your hands'}
              message={
                filter === 'open'
                  ? 'Every run at this site has a courier on it. Pull to refresh.'
                  : 'Take a run from the open list and it will show here.'
              }
              action={
                filter === 'mine' && available.length ? (
                  <Button label="See open runs" onPress={() => setFilter('open')} testID="board-goto-open" />
                ) : undefined
              }
              testID="board-empty"
            />
          ) : (
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Heading>{filter === 'open' ? 'Waiting for a courier' : 'On you now'}</Heading>
                <Muted>{rows.length}</Muted>
              </View>

              {rows.map((run) => (
                <RunCard
                  key={run._id}
                  run={run}
                  highlight={filter === 'mine'}
                  onPress={() => router.push(`/(courier)/run/${run._id}` as never)}
                  action={
                    filter === 'open' ? (
                      <Button
                        label="Take this run"
                        full
                        icon={<Icon name="Hand" size={16} color={COLORS.white} />}
                        loading={claim.isPending && claim.variables?.id === run._id}
                        onPress={() => take(run._id)}
                        testID={`board-take-${run._id}`}
                      />
                    ) : (
                      <Button
                        label="Continue"
                        variant="secondary"
                        full
                        onPress={() => router.push(`/(courier)/run/${run._id}` as never)}
                        testID={`board-continue-${run._id}`}
                      />
                    )
                  }
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
