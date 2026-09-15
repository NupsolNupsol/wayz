import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Button, EmptyState, FeatureCard, Hero, Heading, Icon, Muted } from '@/design'
import { ENGINE_META, enginesFor } from '@/config/engines'
import { useSession } from '@/features/auth/hooks'
import { useCustomers, useShift } from '@/hooks/queries'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { initialsOf } from '@/lib/workspace'
import { COLORS, GRADIENTS, SHADOW, type GradientName } from '@/theme/tokens'
import type { EngineKind } from '@/types'

/** Each activity gets its own wash so an agent learns the counter by colour, not by reading. */
const ENGINE_GRADIENT: Partial<Record<EngineKind, GradientName>> = {
  SHOP_AND_DROP: 'brand',
  MOBILITY: 'navy',
  LAGOON: 'slate',
}

/**
 * The raised middle button lands here: pick what the customer came for.
 *
 * Big targets on purpose — this is tapped with a queue waiting, often on a Sunmi held in one hand.
 */
export default function SellScreen() {
  const router = useRouter()
  const { me } = useSession()
  const { isTablet } = useDeviceClass()
  const shift = useShift()
  const customers = useCustomers('')

  const engines = enginesFor(me?.engineKinds ?? [])
  const tillOpen = shift.data?.status === 'OPEN'

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['left', 'right']} testID="kiosk-sell">
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <Hero
          gradient="kiosk"
          initials={initialsOf(me)}
          name="New sale"
          subtitle="What is the customer here for?"
          bleed={20}
          testID="sell-hero"
        />

        <View className={`${isTablet ? 'px-8' : 'px-5'} -mt-3 gap-6`}>
          {!tillOpen ? (
            <FeatureCard
              icon="Wallet"
              gradient="slate"
              title="Your till is not open"
              message="Nothing can be sold or settled until the drawer is open for this shift."
              action={
                <Button
                  label="Open the till"
                  variant="secondary"
                  onPress={() => router.push('/shift' as never)}
                  testID="sell-open-till"
                />
              }
              testID="sell-till-warning"
            />
          ) : null}

          <View className="gap-3">
            <Heading>Activities</Heading>

            {engines.length === 0 ? (
              <EmptyState
                icon={<Icon name="Boxes" size={26} color={COLORS.faint} />}
                title="No activity assigned"
                message="Your account is not attached to an activity yet. Ask your manager to assign one."
                testID="sell-no-engines"
              />
            ) : (
              <View className="gap-3" testID="sell-engines">
                {engines.map((kind) => {
                  const meta = ENGINE_META[kind]
                  return (
                    <Pressable
                      key={kind}
                      accessibilityRole="button"
                      accessibilityLabel={`${meta.label}. ${meta.tagline}`}
                      testID={`sell-engine-${kind}`}
                      onPress={() =>
                        router.push({ pathname: meta.route, params: { engine: kind } })
                      }
                      className="active:opacity-85"
                    >
                      <LinearGradient
                        colors={[...GRADIENTS[ENGINE_GRADIENT[kind] ?? 'brand']]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[{ borderRadius: 26, padding: 18, overflow: 'hidden' }, SHADOW.card]}
                      >
                        <View className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/10" />
                        <View className="flex-row items-center gap-4">
                          <View className="h-16 w-16 items-center justify-center rounded-3xl bg-white/20">
                            <Icon name={meta.icon} size={28} color={COLORS.white} />
                          </View>
                          <View className="min-w-0 flex-1 gap-0.5">
                            <Text className="text-[19px] font-extrabold text-white">{meta.label}</Text>
                            <Text numberOfLines={1} className="text-[13px] text-white/75">
                              {meta.tagline}
                            </Text>
                          </View>
                          <Icon name="ArrowRight" size={22} color={COLORS.white} />
                        </View>
                      </LinearGradient>
                    </Pressable>
                  )
                })}
              </View>
            )}
          </View>

          <View className="gap-3">
            <Heading>Or find a record</Heading>
            <View className="flex-row gap-3">
              <Shortcut
                icon="Users"
                title="Customers"
                subtitle={customers.data ? `${customers.data.length} on file` : 'Find or add someone'}
                onPress={() => router.push('/customers' as never)}
                testID="sell-customers"
              />
              <Shortcut
                icon="ClipboardList"
                title="Bookings"
                subtitle="Everything taken here"
                onPress={() => router.push('/bookings' as never)}
                testID="sell-bookings"
              />
            </View>
            <Muted>A sale started by mistake can be cancelled from the booking before it is paid.</Muted>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Shortcut({
  icon,
  title,
  subtitle,
  onPress,
  testID,
}: {
  icon: 'Users' | 'ClipboardList'
  title: string
  subtitle: string
  onPress: () => void
  testID?: string
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      testID={testID}
      onPress={onPress}
      className="flex-1 gap-2 rounded-xl3 border border-line bg-surface p-4 active:opacity-70"
      style={SHADOW.card}
    >
      <View className="h-11 w-11 items-center justify-center rounded-2xl bg-canvas">
        <Icon name={icon} size={19} color={COLORS.navy} />
      </View>
      <View>
        <Text className="text-[14px] font-bold text-navy">{title}</Text>
        <Text numberOfLines={1} className="text-[12px] text-muted">
          {subtitle}
        </Text>
      </View>
    </Pressable>
  )
}
