import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { FlatList, View } from 'react-native'

import { AppHeader } from '@/components/AppHeader'
import { Icon } from '@/components/Icon'
import { EmptyState, Input, ListGroup, ListRow, Loading, Muted, Ref, Screen, Segmented, StatusPill } from '@/components/ui'
import { engineLabel } from '@/config/engines'
import { useBookings } from '@/hooks/queries'
import { formatDateTime } from '@/lib/format'
import { COLORS } from '@/theme/tokens'

type Filter = 'live' | 'done' | 'all'

const LIVE = ['CONFIRMED', 'RESERVED', 'ACTIVE', 'OVERTIME', 'RETRIEVAL_IN_PROGRESS', 'PREPARING', 'SERVED']

export default function Bookings() {
  const [filter, setFilter] = useState<Filter>('live')
  const [query, setQuery] = useState('')
  const { data = [], isLoading, isFetching, refetch } = useBookings()

  const rows = useMemo(() => {
    const byFilter = data.filter((b) => {
      if (filter === 'live') return LIVE.includes(b.status)
      if (filter === 'done') return ['COMPLETED', 'CANCELLED'].includes(b.status)
      return true
    })

    const term = query.trim().toLowerCase()
    const searched = term
      ? byFilter.filter((b) =>
          [b.ref, b.customerName, b.customerPhone, b.productName].filter(Boolean).join(' ').toLowerCase().includes(term),
        )
      : byFilter

    return [...searched].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [data, filter, query])

  return (
    <Screen padded={false} testID="bookings">
      <View className="gap-3 px-4 pb-3 pt-2">
        <AppHeader back title="Bookings" subtitle="Everything this station has taken" />
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search a reference, a name, a phone…"
          autoCapitalize="none"
          autoCorrect={false}
          testID="bookings-search"
        />
        <Segmented
          value={filter}
          onChange={setFilter}
          testID="bookings-filter"
          options={[
            { value: 'live', label: 'Live' },
            { value: 'done', label: 'Finished' },
            { value: 'all', label: 'All' },
          ]}
        />
      </View>

      {isLoading && !data.length ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          onRefresh={() => void refetch()}
          refreshing={isFetching}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-4 pb-6"
          ListEmptyComponent={
            <EmptyState
              icon={<Icon name="Package" size={24} color={COLORS.faint} />}
              title={query ? 'Nothing matches' : 'No bookings'}
              message={query ? 'Try a shorter search.' : 'Bookings you take appear here.'}
              testID="bookings-empty"
            />
          }
          renderItem={({ item, index }) => (
            <ListGroup className={index === 0 ? '' : 'mt-2'}>
              <ListRow
                testID={`booking-row-${item.id}`}
                onPress={() => router.push({ pathname: '/booking/[id]', params: { id: item.id } })}
                title={<Ref>{item.ref}</Ref>}
                subtitle={`${item.customerName || 'Walk-in'} · ${engineLabel(item.engineKind)}`}
                trailing={
                  <>
                    <StatusPill status={item.status} size="sm" />
                    <Muted className="text-[11px]">{formatDateTime(item.createdAt)}</Muted>
                  </>
                }
              />
            </ListGroup>
          )}
        />
      )}
    </Screen>
  )
}
