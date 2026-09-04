import { Check } from 'lucide-react-native'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { useDeviceClass } from '@/hooks/useDeviceClass'
import { COLORS } from '@/theme/tokens'

export interface WizardStep {
  key: string
  label: string
}

export function StepBar({
  steps,
  current,
  onStep,
  canRevisit,
  testID,
}: {
  steps: WizardStep[]
  current: number
  onStep?: (index: number) => void
  canRevisit?: (index: number) => boolean
  testID?: string
}) {
  const { isTablet } = useDeviceClass()

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="flex-row items-center gap-1.5 py-1"
      testID={testID}
    >
      {steps.map((step, index) => {
        const done = index < current
        const active = index === current
        const revisitable = !!onStep && done && (canRevisit ? canRevisit(index) : true)

        return (
          <View key={step.key} className="flex-row items-center gap-1.5">
            <Pressable
              accessibilityRole={revisitable ? 'button' : undefined}
              accessibilityState={{ selected: active }}
              onPress={revisitable ? () => onStep(index) : undefined}
              testID={`step-${step.key}`}
              className={`h-9 flex-row items-center gap-2 rounded-full border px-3 ${
                active
                  ? 'border-brand bg-brand'
                  : done
                    ? 'border-success/30 bg-success-soft'
                    : 'border-line bg-surface'
              }`}
            >
              <View
                className={`h-5 w-5 items-center justify-center rounded-full ${
                  active ? 'bg-white/25' : done ? 'bg-success' : 'bg-canvas'
                }`}
              >
                {done ? (
                  <Check size={11} color={COLORS.white} strokeWidth={3} />
                ) : (
                  <Text className={`text-[10px] font-bold ${active ? 'text-white' : 'text-muted'}`}>{index + 1}</Text>
                )}
              </View>

              {active || isTablet ? (
                <Text
                  className={`text-[12px] font-semibold ${active ? 'text-white' : done ? 'text-success' : 'text-muted'}`}
                >
                  {step.label}
                </Text>
              ) : null}
            </Pressable>

            {index < steps.length - 1 ? <View className="h-px w-3 bg-line" /> : null}
          </View>
        )
      })}
    </ScrollView>
  )
}

export function Meter({
  value,
  max,
  tone = 'brand',
  testID,
}: {
  value: number
  max: number
  tone?: 'brand' | 'success' | 'warn' | 'danger'
  testID?: string
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const fill = { brand: 'bg-brand', success: 'bg-success', warn: 'bg-warn', danger: 'bg-danger' }[tone]

  return (
    <View className="h-2 overflow-hidden rounded-full bg-canvas" testID={testID} accessibilityValue={{ now: pct, min: 0, max: 100 }}>
      <View className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
    </View>
  )
}
