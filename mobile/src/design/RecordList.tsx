import type { ReactNode } from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon, type IconName } from '@/components/Icon'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { COLORS, SHADOW, TONE_HEX, type Tone } from '@/theme/tokens'

import { Hero } from './Hero'
import { Segmented } from '@/components/ui/Controls'
import { EmptyState, Loading } from '@/components/ui/Feedback'
import { Input } from '@/components/ui/Field'

/**
 * The shape every record screen shares: a crown, a search box, a row of filters, and a list.
 *
 * Bookings, customers, assets and incidents were four hand-rolled versions of this. One component
 * means they scroll, filter and empty out identically, and a change to the pattern is one edit.
 */
export function RecordList<T>({
  title,
  subtitle,
  initials,
  headline,
  headlineLabel,
  query,
  onQuery,
  searchPlaceholder,
  filters,
  filter,
  onFilter,
  rows,
  keyOf,
  renderRow,
  loading = false,
  refreshing = false,
  onRefresh,
  emptyIcon = 'Package',
  emptyTitle,
  emptyMessage,
  testID,
}: {
  title: string
  subtitle?: string
  initials: string
  headline?: string
  headlineLabel?: string
  query: string
  onQuery: (value: string) => void
  searchPlaceholder: string
  filters?: { value: string; label: string; count?: number }[]
  filter?: string
  onFilter?: (value: string) => void
  rows: T[]
  keyOf: (row: T) => string
  renderRow: (row: T) => ReactNode
  loading?: boolean
  refreshing?: boolean
  onRefresh?: () => void
  emptyIcon?: IconName
  emptyTitle: string
  emptyMessage: string
  testID?: string
}) {
  const { isTablet } = useDeviceClass()
  const pad = isTablet ? 'px-8' : 'px-5'

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['left', 'right']} testID={testID}>
      <Hero
        gradient="kiosk"
        initials={initials}
        name={title}
        subtitle={subtitle}
        headline={headline}
        headlineLabel={headlineLabel}
        bleed={headline ? 26 : 20}
      />

      <View className={`${pad} ${headline ? '-mt-4' : '-mt-3'} gap-3 pb-3`}>
        <View className="rounded-2xl bg-surface" style={SHADOW.pop}>
          <Input
            value={query}
            onChangeText={onQuery}
            placeholder={searchPlaceholder}
            autoCapitalize="none"
            autoCorrect={false}
            testID={testID ? `${testID}-search` : undefined}
          />
        </View>

        {filters && filter !== undefined && onFilter ? (
          <Segmented value={filter} options={filters} onChange={onFilter} testID={testID ? `${testID}-filter` : undefined} />
        ) : null}
      </View>

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={keyOf}
          onRefresh={onRefresh}
          refreshing={refreshing}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerClassName={`${pad} pb-8 gap-3`}
          ListEmptyComponent={
            <EmptyState
              icon={<Icon name={emptyIcon} size={26} color={COLORS.faint} />}
              title={emptyTitle}
              message={emptyMessage}
              testID={testID ? `${testID}-empty` : undefined}
            />
          }
          renderItem={({ item }) => <>{renderRow(item)}</>}
        />
      )}
    </SafeAreaView>
  )
}

/**
 * One record, as a card: an icon in its state's colour, a headline, a supporting line, and
 * whatever the screen wants on the right.
 */
export function RecordCard({
  icon,
  tone = 'brand',
  title,
  subtitle,
  meta,
  right,
  onPress,
  testID,
}: {
  icon: IconName
  tone?: Tone
  title: string
  subtitle?: string
  meta?: ReactNode
  right?: ReactNode
  onPress?: () => void
  testID?: string
}) {
  const hex = TONE_HEX[tone]

  const body = (
    <View className="flex-row items-start gap-3 rounded-xl3 border border-line bg-surface p-4" style={SHADOW.card}>
      <View className="h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${hex}1a` }}>
        <Icon name={icon} size={19} color={hex} />
      </View>

      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-[15px] font-bold text-navy">
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} className="mt-0.5 text-[12px] text-muted">
            {subtitle}
          </Text>
        ) : null}
        {meta ? <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1">{meta}</View> : null}
      </View>

      {right ? <View className="items-end">{right}</View> : null}
    </View>
  )

  if (!onPress) {
    return (
      <View testID={testID}>{body}</View>
    )
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={onPress}
      testID={testID}
      className="active:opacity-80"
    >
      {body}
    </Pressable>
  )
}
