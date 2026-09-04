import { Text, View } from 'react-native'

import { humanise, TONE_CLASS, toneFor, type Tone } from '@/theme/tokens'

export function StatusPill({
  status,
  tone,
  label,
  size = 'md',
  testID,
}: {
  status?: string | null
  tone?: Tone
  label?: string
  size?: 'sm' | 'md'
  testID?: string
}) {
  const resolved = tone ?? toneFor(status)
  const t = TONE_CLASS[resolved]
  const text = label ?? humanise(status)

  return (
    <View
      className={`self-start flex-row items-center gap-1.5 rounded-full border ${t.box} ${t.border} ${
        size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'
      }`}
      testID={testID}
    >
      <View className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      <Text className={`font-bold uppercase tracking-wide ${t.text} ${size === 'sm' ? 'text-[10px]' : 'text-[11px]'}`}>
        {text}
      </Text>
    </View>
  )
}
