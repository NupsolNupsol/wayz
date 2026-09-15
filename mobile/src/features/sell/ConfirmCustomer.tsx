import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'

import { apiMessage } from '@/api/client'
import { otpApi, type OtpIntent } from '@/api/endpoints'
import { Body, Button, Field, Icon, Input, Muted, Notice, Segmented, toast } from '@/design'
import { COLORS } from '@/theme/tokens'
import type { OtpChannel } from '@/types'

/**
 * How long the server honours a confirmation. We stop trusting it a minute early: an agent who
 * presses Confirm on a proof that lapsed a second ago is refused with the customer standing there.
 */
const PROOF_MIN = 30
const LAPSE_MS = (PROOF_MIN - 1) * 60_000

/**
 * The customer proving they are themselves.
 *
 * No money moves on this platform without it — the server refuses a payment from anyone it has not
 * seen a code from recently, so this is a step in the sale, not a nicety. A code goes out over
 * WhatsApp, SMS or email — whichever actually reaches them — and they read it back.
 */
export function ConfirmCustomer({
  phone,
  email,
  intent = 'VERIFY_PHONE',
  verified,
  onVerified,
  testID = 'confirm-customer',
}: {
  phone: string
  email?: string
  intent?: OtpIntent
  verified: boolean
  onVerified: (ok: boolean) => void
  testID?: string
}) {
  const [channel, setChannel] = useState<OtpChannel>('WHATSAPP')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  // WhatsApp and SMS both go to the phone; only email goes anywhere else.
  const destination = channel === 'EMAIL' ? (email ?? '') : phone
  const lapse = useRef<ReturnType<typeof setTimeout> | null>(null)

  // A different person, or a different channel, means starting again.
  useEffect(() => {
    setSent(false)
    setCode('')
  }, [phone, channel])

  /** Let the tick box expire on its own rather than lying until the payment is refused. */
  useEffect(() => {
    if (!verified) return
    lapse.current = setTimeout(() => {
      onVerified(false)
      setSent(false)
      toast('warn', 'Confirmation lapsed', 'Send them another code before taking the money.')
    }, LAPSE_MS)
    return () => {
      if (lapse.current) clearTimeout(lapse.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verified])

  const send = async () => {
    if (!destination) return
    setBusy(true)
    try {
      const result = await otpApi.send(destination, intent, channel)
      setSent(true)
      const via = channel === 'EMAIL' ? 'email' : channel === 'SMS' ? 'SMS' : 'WhatsApp'
      if (result.code) toast('info', `Code ${result.code}`, `Sent to ${destination} — type it below.`)
      else toast('success', `Code sent by ${via}`, destination)
    } catch (e) {
      toast('danger', 'Could not send the code', apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const check = async () => {
    setBusy(true)
    try {
      const { verified: ok } = await otpApi.verify(destination, code.trim(), intent)
      onVerified(ok)
      toast(ok ? 'success' : 'danger', ok ? 'Customer confirmed' : 'That code is wrong', ok ? undefined : 'Try again, or send a new one.')
      if (!ok) setCode('')
    } catch (e) {
      toast('danger', 'Could not check the code', apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (verified) {
    return (
      <Notice tone="success" testID={`${testID}-done`}>
        <View className="flex-row items-center gap-2">
          <Icon name="ShieldCheck" size={16} color={COLORS.success} />
          <Body className="flex-1 font-semibold">Confirmed — good for {PROOF_MIN} minutes.</Body>
        </View>
      </Notice>
    )
  }

  return (
    <View className="gap-3" testID={testID}>
      {/*
        Always offered, not only when there is an email.

        A customer's WhatsApp number is often not the number they answer, so the agent has
        to be able to say "send it as a text" without leaving the sale.
      */}
      <Segmented
        value={channel}
        onChange={setChannel}
        testID={`${testID}-channel`}
        options={[
          { value: 'WHATSAPP' as const, label: 'WhatsApp' },
          { value: 'SMS' as const, label: 'SMS' },
          ...(email ? [{ value: 'EMAIL' as const, label: 'Email' }] : []),
        ]}
      />

      <Muted>
        {destination ? `A code goes to ${destination}.` : 'No way to reach them — add a phone number first.'}
      </Muted>

      {!sent ? (
        <Button
          label="Send them a code"
          full
          disabled={!destination}
          loading={busy}
          icon={<Icon name="Send" size={16} color={COLORS.white} />}
          onPress={() => void send()}
          testID={`${testID}-send`}
        />
      ) : (
        <View className="gap-3">
          <Field label="The code they read back" required>
            <Input
              value={code}
              onChangeText={setCode}
              placeholder="6 digits"
              keyboardType="number-pad"
              maxLength={6}
              testID={`${testID}-code`}
            />
          </Field>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button
                label="Send again"
                variant="secondary"
                full
                loading={busy}
                onPress={() => void send()}
                testID={`${testID}-resend`}
              />
            </View>
            <View className="flex-1">
              <Button
                label="Confirm"
                full
                disabled={code.trim().length < 4}
                loading={busy}
                onPress={() => void check()}
                testID={`${testID}-verify`}
              />
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
