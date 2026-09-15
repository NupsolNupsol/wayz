import { LinearGradient } from 'expo-linear-gradient'
import { Redirect, useRouter } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { apiMessage } from '@/api/client'
import { Button, Field, Heading, Icon, Input, Muted, Notice, toast } from '@/design'
import { DEMO_ACCOUNTS, DEMO_ACCOUNTS_ENABLED, type DemoAccount } from '@/features/auth/demoAccounts'
import { NoWorkspaceError, useSignIn } from '@/features/auth/hooks'
import { useDeviceClass } from '@/hooks/useDeviceClass'
import { firstNameOf, homeFor, workspaceFor } from '@/lib/workspace'
import { useSessionStore } from '@/store/session.store'
import { COLORS, GRADIENTS, SHADOW, TONE_HEX } from '@/theme/tokens'

/**
 * One door for both workspaces.
 *
 * The app does not ask which app you want — the role on the account decides, and the redirect
 * lands you in the counter or on the road. Anyone whose work lives on the web is told so here
 * rather than being dropped into a workspace they cannot use.
 */
export default function SignInScreen() {
  const router = useRouter()
  const ready = useSessionStore((s) => s.ready)
  const token = useSessionStore((s) => s.token)
  const { isTablet } = useDeviceClass()
  const login = useSignIn()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const submit = (credentials?: { email: string; password: string }) => {
    const payload = credentials ?? { email: email.trim(), password }
    setError(null)

    if (!payload.email || !payload.password) {
      setError('Enter your email and password.')
      return
    }

    login.mutate(payload, {
      onSuccess: (result) => {
        toast(
          'success',
          `Welcome, ${firstNameOf(result.user)}`,
          workspaceFor(result.user.role) === 'courier'
            ? 'Your runs are ready'
            : (result.user.station?.name ?? undefined),
        )
        router.replace(homeFor(result.user.role) as never)
      },
      onError: (e) =>
        setError(e instanceof NoWorkspaceError ? e.message : apiMessage(e, 'Those credentials were not accepted.')),
    })
  }

  const useAccount = (account: DemoAccount) => {
    setEmail(account.email)
    setPassword(account.password)
    setPickerOpen(false)
    submit({ email: account.email, password: account.password })
  }

  if (ready && token) return <Redirect href="/" />

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['left', 'right', 'bottom']} testID="sign-in">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={[...GRADIENTS.kiosk]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingTop: 72, paddingBottom: 64, borderBottomLeftRadius: 34, borderBottomRightRadius: 34 }}
          >
            <View className="items-center gap-3 px-6">
              <View className="h-[68px] w-[68px] items-center justify-center rounded-3xl bg-white/20">
                <Icon name="Boxes" size={32} color={COLORS.white} />
              </View>
              <Text className="text-[30px] font-extrabold tracking-tight text-white">WAYZ</Text>
              <Text className="text-center text-[13px] text-white/70">
                The counter and the road, on one device
              </Text>
            </View>
          </LinearGradient>

          <View className={`w-full self-center px-5 ${isTablet ? 'max-w-lg' : ''}`}>
            <View className="-mt-10 gap-4 rounded-xl3 border border-line bg-surface p-5" style={SHADOW.pop}>
              <Heading>Sign in</Heading>

              <Field label="Email">
                <Input
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@company.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  testID="sign-in-email"
                />
              </Field>

              <Field label="Password">
                <Input
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry
                  autoCapitalize="none"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={() => submit()}
                  testID="sign-in-password"
                />
              </Field>

              {error ? (
                <Notice tone="danger" testID="sign-in-error">
                  <Text className="text-[13px] leading-[18px] text-navy">{error}</Text>
                </Notice>
              ) : null}

              <Button
                label="Sign in"
                size="lg"
                full
                loading={login.isPending}
                onPress={() => submit()}
                testID="sign-in-submit"
              />
            </View>

            {DEMO_ACCOUNTS_ENABLED ? (
              <View className="mt-5 gap-3">
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setPickerOpen((open) => !open)}
                  testID="sign-in-demo-toggle"
                  className="flex-row items-center justify-center gap-1.5 py-1 active:opacity-60"
                >
                  <Icon name="Sparkles" size={14} color={COLORS.brandDark} />
                  <Text className="text-[13px] font-bold text-brand-ink">
                    {pickerOpen ? 'Hide demo accounts' : 'Use a demo account'}
                  </Text>
                  <Icon name={pickerOpen ? 'ChevronDown' : 'ChevronRight'} size={14} color={COLORS.brandDark} />
                </Pressable>

                {pickerOpen ? (
                  <View className="gap-2" testID="sign-in-demo-list">
                    {DEMO_ACCOUNTS.map((account) => {
                      const hex = TONE_HEX[account.tone]
                      return (
                        <Pressable
                          key={account.email}
                          accessibilityRole="button"
                          accessibilityLabel={`Sign in as ${account.name}, ${account.role}`}
                          onPress={() => useAccount(account)}
                          testID={`demo-${account.email.split('@')[0]}`}
                          className="flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-3 active:opacity-70"
                        >
                          <View
                            className="h-10 w-10 items-center justify-center rounded-xl"
                            style={{ backgroundColor: `${hex}1a` }}
                          >
                            <Icon name={account.icon} size={18} color={hex} />
                          </View>
                          <View className="min-w-0 flex-1">
                            <Text numberOfLines={1} className="text-[14px] font-bold text-navy">
                              {account.name}
                            </Text>
                            <Text numberOfLines={1} className="text-[12px] text-muted">
                              {account.role} · {account.detail}
                            </Text>
                          </View>
                          <Icon name="ArrowRight" size={16} color={COLORS.faint} />
                        </Pressable>
                      )
                    })}
                  </View>
                ) : null}
              </View>
            ) : null}

            <Muted className="mb-6 mt-6 text-center">
              Your account decides what opens: a counter, or the delivery board.
            </Muted>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
