import { Text, View } from 'react-native'

import { Icon, type IconName } from '@/components/Icon'
import { COLORS, TONE_HEX, type Tone } from '@/theme/tokens'

export interface TrailStep {
  key: string
  label: string
  icon: IconName
}

/**
 * The horizontal run of a job: where it has been, where it is, what is left. Drawn as dots joined
 * by a rail so it reads at a glance from arm's length, which is how a courier holds a phone.
 */
export function StepTrail({ steps, current, testID }: { steps: TrailStep[]; current: number; testID?: string }) {
  return (
    <View className="flex-row" testID={testID}>
      {steps.map((step, i) => {
        const done = i < current
        const active = i === current
        const reached = done || active
        return (
          <View key={step.key} className="flex-1 items-center">
            <View className="w-full flex-row items-center">
              <View className={`h-[3px] flex-1 rounded-full ${i === 0 ? 'bg-transparent' : done || active ? 'bg-brand' : 'bg-line'}`} />
              <View
                className={`h-9 w-9 items-center justify-center rounded-full border-2 ${
                  active ? 'border-brand bg-brand' : done ? 'border-brand bg-brand-soft' : 'border-line bg-surface'
                }`}
                testID={`${testID}-step-${step.key}`}
              >
                <Icon
                  name={done ? 'Check' : step.icon}
                  size={15}
                  color={active ? COLORS.white : done ? COLORS.brandDark : COLORS.faint}
                  strokeWidth={2.4}
                />
              </View>
              <View className={`h-[3px] flex-1 rounded-full ${i === steps.length - 1 ? 'bg-transparent' : done ? 'bg-brand' : 'bg-line'}`} />
            </View>
            <Text
              numberOfLines={2}
              className={`mt-1.5 px-0.5 text-center text-[10px] font-semibold leading-[13px] ${
                reached ? 'text-navy' : 'text-faint'
              }`}
            >
              {step.label}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

export interface TimelineEntry {
  key: string
  title: string
  note?: string
  at: string
  tone?: Tone
}

/** What has already happened, newest last — the audit trail a supervisor will ask about. */
export function Timeline({ entries, testID }: { entries: TimelineEntry[]; testID?: string }) {
  return (
    <View testID={testID}>
      {entries.map((entry, i) => {
        const hex = TONE_HEX[entry.tone ?? 'brand']
        const last = i === entries.length - 1
        return (
          <View key={entry.key} className="flex-row gap-3">
            <View className="items-center pt-1">
              <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: hex }} />
              {!last ? <View className="w-[2px] flex-1 bg-line" /> : null}
            </View>
            <View className={`min-w-0 flex-1 ${last ? '' : 'pb-4'}`}>
              <Text className="text-[14px] font-semibold text-navy">{entry.title}</Text>
              {entry.note ? <Text className="mt-0.5 text-[12px] leading-4 text-muted">{entry.note}</Text> : null}
              <Text className="mt-0.5 text-[11px] text-faint">{entry.at}</Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

/**
 * The week at a glance. Deliberately axis-free: a courier wants the shape of their week, and a
 * y-axis on a 360pt screen costs more room than it returns.
 */
export function BarChart({
  data,
  height = 116,
  testID,
}: {
  data: { label: string; value: number }[]
  height?: number
  testID?: string
}) {
  const peak = Math.max(1, ...data.map((d) => d.value))

  return (
    <View testID={testID}>
      <View className="flex-row items-end gap-2" style={{ height }}>
        {data.map((bar, i) => {
          const ratio = bar.value / peak
          const today = i === data.length - 1
          return (
            <View key={bar.label} className="flex-1 items-center justify-end gap-1.5">
              {bar.value > 0 ? (
                <Text className="text-[10px] font-bold text-navy" style={{ fontVariant: ['tabular-nums'] }}>
                  {bar.value}
                </Text>
              ) : null}
              <View
                className={`w-full rounded-full ${today ? 'bg-brand' : 'bg-navy/15'}`}
                style={{ height: Math.max(6, ratio * (height - 26)) }}
                testID={`${testID}-bar-${bar.label}`}
              />
            </View>
          )
        })}
      </View>
      <View className="mt-2 flex-row gap-2">
        {data.map((bar, i) => (
          <Text
            key={bar.label}
            className={`flex-1 text-center text-[10px] ${i === data.length - 1 ? 'font-bold text-navy' : 'text-faint'}`}
          >
            {bar.label}
          </Text>
        ))}
      </View>
    </View>
  )
}
