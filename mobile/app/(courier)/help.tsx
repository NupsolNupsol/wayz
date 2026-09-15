import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Heading, Icon, Notice, ScreenHeader } from '@/design'
import { DELIVERY_TRAIL } from '@/features/courier/model'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { COLORS, SHADOW } from '@/theme/tokens'

const STEPS = [
  {
    title: 'Take a run',
    body: 'Open runs sit on the board for anyone at your site. The first courier to take one owns it — it disappears from everyone else’s board.',
  },
  {
    title: 'Walk to the desk',
    body: 'The run names the desk holding the bags. Tap “Ask for the bags” when you get there so the agent knows you are waiting.',
  },
  {
    title: 'Scan what you are handed',
    body: 'Scan every bag as it comes out. The desk knows which codes belong to the customer, so a bag that is not theirs is refused before you carry it.',
  },
  {
    title: 'Hand them over',
    body: 'Take them to the address on the run and close it. If something goes wrong, report it with a reason — that reason goes back to the desk.',
  },
]

export default function CourierHelpScreen() {
  const { isTablet } = useDeviceClass()

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['left', 'right']} testID="courier-help">
      <ScreenHeader title="How a run works" subtitle="Four steps, start to finish" fallback="/(courier)/more" />

      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View className={`${isTablet ? 'px-8' : 'px-5'} gap-5 pt-5`}>
          {STEPS.map((step, i) => (
            <View
              key={step.title}
              className="flex-row gap-3 rounded-xl3 border border-line bg-surface p-4"
              style={SHADOW.card}
              testID={`help-step-${i}`}
            >
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft">
                <Icon name={DELIVERY_TRAIL[i]?.icon ?? 'Truck'} size={19} color={COLORS.brandDark} />
              </View>
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-[15px] font-bold text-navy">
                  {i + 1}. {step.title}
                </Text>
                <Text className="text-[13px] leading-[19px] text-muted">{step.body}</Text>
              </View>
            </View>
          ))}

          <View className="gap-3">
            <Heading>Two things to know</Heading>
            <Notice tone="info">
              <Text className="text-[13px] leading-[18px] text-navy">
                You never take money. Anything the customer owes is settled at the desk that raised the run.
              </Text>
            </Notice>
            <Notice tone="warn">
              <Text className="text-[13px] leading-[18px] text-navy">
                Once you are carrying bags you cannot give the run back — report a problem instead, so the desk knows
                where the bags are.
              </Text>
            </Notice>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
