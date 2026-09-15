import { useMemo, useState } from 'react'
import { FlatList, View } from 'react-native'

import {
  EmptyState,
  Icon,
  Input,
  ListGroup,
  ListRow,
  Loading,
  MiniStat,
  Muted,
  Ref,
  Screen,
  ScreenHeader,
  Segmented,
  StatusPill,
} from '@/design'
import { unitCaption } from '@/features/sell'
import { useUnits } from '@/hooks/queries'
import { KIOSK_TABS } from '@/lib/navigation'
import { COLORS } from '@/theme/tokens'

type Filter = 'free' | 'busy' | 'down' | 'all'

const BUSY = ['OCCUPIED', 'RESERVED', 'HELD', 'RETRIEVAL_PENDING']
const DOWN = ['OUT_OF_SERVICE', 'MAINTENANCE', 'BLOCKED', 'INSPECTION_REQUIRED']

/**
 * Everything this desk has on the floor.
 *
 * Opens on what is free, because the question an agent brings to this screen is almost always
 * "can I sell another one" — the broken and the busy are a tap away when they are not.
 */
export default function Assets() {
  const [filter, setFilter] = useState<Filter>('free')
  const [query, setQuery] = useState('')
  const { data = [], isLoading, isFetching, refetch } = useUnits()

  const counts = useMemo(
    () => ({
      free: data.filter((u) => u.status === 'AVAILABLE').length,
      busy: data.filter((u) => BUSY.includes(u.status)).length,
      down: data.filter((u) => DOWN.includes(u.status)).length,
      all: data.length,
    }),
    [data],
  )

  const rows = useMemo(() => {
    const byFilter = data.filter((u) => {
      if (filter === 'free') return u.status === 'AVAILABLE'
      if (filter === 'busy') return BUSY.includes(u.status)
      if (filter === 'down') return DOWN.includes(u.status)
      return true
    })
    const term = query.trim().toLowerCase()
    return term
      ? byFilter.filter(
          (u) =>
            u.identifier.toLowerCase().includes(term) || (u.assetTypeName ?? '').toLowerCase().includes(term),
        )
      : byFilter
  }, [data, filter, query])

  return (
    <Screen
      padded={false}
      testID="assets"
      header={<ScreenHeader title="Assets" subtitle="What is free, busy or out of service" fallback={KIOSK_TABS.operations} />}
    >
      <View className="gap-3 px-4 pb-3 pt-3">
        <View className="flex-row gap-2">
          <MiniStat icon="Grid3x3" label="Free" value={counts.free} tone="success" testID="assets-free" />
          <MiniStat icon="Package" label="In use" value={counts.busy} tone="info" testID="assets-busy" />
          <MiniStat
            icon="AlertTriangle"
            label="Down"
            value={counts.down}
            tone={counts.down ? 'danger' : 'neutral'}
            testID="assets-down"
          />
        </View>

        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Find a compartment or vehicle"
          autoCapitalize="characters"
          autoCorrect={false}
          testID="assets-search"
        />

        <Segmented
          value={filter}
          onChange={setFilter}
          testID="assets-filter"
          options={[
            { value: 'free', label: 'Free', count: counts.free },
            { value: 'busy', label: 'In use', count: counts.busy },
            { value: 'down', label: 'Down', count: counts.down },
            { value: 'all', label: 'All', count: counts.all },
          ]}
        />
      </View>

      {isLoading && !data.length ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item._id}
          onRefresh={() => void refetch()}
          refreshing={isFetching}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-4 pb-6"
          ListEmptyComponent={
            <EmptyState
              icon={<Icon name="Grid3x3" size={24} color={COLORS.faint} />}
              title="Nothing here"
              message="Units provisioned for this desk appear here."
              testID="assets-empty"
            />
          }
          renderItem={({ item, index }) => (
            <ListGroup className={index === 0 ? '' : 'mt-2'}>
              <ListRow
                chevron={false}
                testID={`asset-${item._id}`}
                title={<Ref>{item.identifier}</Ref>}
                subtitle={item.currentBookingId ? 'Holding a booking' : unitCaption(item) || undefined}
                trailing={
                  <View className="items-end gap-1">
                    <StatusPill status={item.status} size="sm" />
                    {item.assetTypeName ? <Muted className="text-[11px]">{item.assetTypeName}</Muted> : null}
                  </View>
                }
              />
            </ListGroup>
          )}
        />
      )}
    </Screen>
  )
}
