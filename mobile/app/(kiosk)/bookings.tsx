import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Text } from 'react-native'

import { Icon, RecordCard, RecordList, StatusPill } from '@/design'
import { ENGINE_META, engineLabel } from '@/config/engines'
import { useSession } from '@/features/auth/hooks'
import { useBookings } from '@/hooks/queries'
import { formatDateTime } from '@/lib/format'
import { initialsOf } from '@/lib/workspace'
import { COLORS, toneFor } from '@/theme/tokens'

type Filter = 'live' | 'done' | 'all'

const LIVE = ['CONFIRMED', 'RESERVED', 'ACTIVE', 'OVERTIME', 'RETRIEVAL_IN_PROGRESS', 'PREPARING', 'SERVED']

export default function BookingsScreen() {
  const router = useRouter()
  const { me } = useSession()
  const [filter, setFilter] = useState<Filter>('live')
  const [query, setQuery] = useState('')
  const { data = [], isLoading, isFetching, refetch } = useBookings()

  const counts = useMemo(
    () => ({
      live: data.filter((b) => LIVE.includes(b.status)).length,
      done: data.filter((b) => ['COMPLETED', 'CANCELLED'].includes(b.status)).length,
      all: data.length,
    }),
    [data],
  )

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
    <RecordList
      testID="kiosk-bookings"
      title="Bookings"
      subtitle="Everything this desk has taken"
      initials={initialsOf(me)}
      headlineLabel="Live now"
      headline={String(counts.live)}
      query={query}
      onQuery={setQuery}
      searchPlaceholder="Search a reference, a name, a phone…"
      filter={filter}
      onFilter={(v) => setFilter(v as Filter)}
      filters={[
        { value: 'live', label: 'Live', count: counts.live },
        { value: 'done', label: 'Finished', count: counts.done },
        { value: 'all', label: 'All', count: counts.all },
      ]}
      rows={rows}
      keyOf={(b) => b.id}
      loading={isLoading && !data.length}
      refreshing={isFetching}
      onRefresh={() => void refetch()}
      emptyIcon="ClipboardList"
      emptyTitle={query ? 'Nothing matches' : 'No bookings'}
      emptyMessage={query ? 'Try a shorter search.' : 'Bookings you take appear here.'}
      renderRow={(b) => (
        <RecordCard
          testID={`booking-row-${b.id}`}
          icon={ENGINE_META[b.engineKind]?.icon ?? 'Package'}
          tone={toneFor(b.status)}
          title={b.customerName || 'Walk-in'}
          subtitle={`${engineLabel(b.engineKind)} · ${b.productName}`}
          onPress={() => router.push({ pathname: '/booking/[id]', params: { id: b.id } })}
          meta={
            <>
              <Text className="font-mono text-[11px] text-faint">{b.ref}</Text>
              <Text className="text-[11px] text-muted">{formatDateTime(b.createdAt)}</Text>
              {b.bags?.length ? (
                <Text className="flex-row text-[11px] text-muted">
                  <Icon name="Package" size={10} color={COLORS.faint} /> {b.bags.length} bags
                </Text>
              ) : null}
            </>
          }
          right={<StatusPill status={b.status} size="sm" />}
        />
      )}
    />
  )
}
