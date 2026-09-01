import { useState } from 'react'
import { View } from 'react-native'

import { apiMessage } from '@/api/client'
import { Icon } from '@/components/Icon'
import {
  Body,
  Button,
  Field,
  Input,
  Muted,
  Notice,
  OptionRow,
  Segmented,
  Sheet,
  TextArea,
  toast,
} from '@/components/ui'
import { useConfirmVerification, useSendVerification } from '@/hooks/queries'
import { COLORS } from '@/theme/tokens'
import type { Booking, IdDocumentType } from '@/types'

type Tab = 'code' | 'document'

const DOC_TYPES: { value: IdDocumentType; label: string }[] = [
  { value: 'NATIONAL_ID', label: 'National ID' },
  { value: 'IQAMA', label: 'Iqama' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'DRIVING_LICENCE', label: 'Driving licence' },
]

/**
 * Proving the person at the counter owns the booking. The code goes to the contact recorded
 * when the booking was made — it cannot be retyped here — and every fallback needs a written
 * reason that lands in the audit trail.
 */
export function VerifySheet({
  open,
  onClose,
  booking,
  onVerified,
}: {
  open: boolean
  onClose: () => void
  booking: Booking
  onVerified: () => void
}) {
  const send = useSendVerification()
  const confirm = useConfirmVerification()

  const [tab, setTab] = useState<Tab>('code')
  const [channel, setChannel] = useState<'WHATSAPP' | 'EMAIL'>('WHATSAPP')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')

  const [docType, setDocType] = useState<IdDocumentType>('NATIONAL_ID')
  const [docNumber, setDocNumber] = useState('')
  const [holder, setHolder] = useState(booking.customerName ?? '')
  const [reason, setReason] = useState('')

  const done = () => {
    toast('success', 'Customer verified', 'Retrieval is authorised.')
    setCode('')
    setSentTo(null)
    onVerified()
    onClose()
  }

  const sendCode = () =>
    send.mutate(
      { id: booking.id, channel },
      {
        onSuccess: (challenge) => {
          setSentTo(challenge.destinationMasked)
          if (challenge.error) toast('warn', 'The provider did not confirm delivery', challenge.error)
          else toast('success', 'Code sent', challenge.destinationMasked)
        },
        onError: (e) => toast('danger', 'Could not send the code', apiMessage(e)),
      },
    )

  const confirmCode = () =>
    confirm.mutate(
      { id: booking.id, input: { method: channel === 'WHATSAPP' ? 'WHATSAPP_OTP' : 'EMAIL_OTP', code: code.trim() } },
      { onSuccess: done, onError: (e) => toast('danger', 'Not verified', apiMessage(e)) },
    )

  const confirmDocument = () =>
    confirm.mutate(
      {
        id: booking.id,
        input: {
          method: 'ID_DOCUMENT',
          reason: reason.trim(),
          document: { documentType: docType, documentNumber: docNumber.trim(), holderName: holder.trim() },
        },
      },
      { onSuccess: done, onError: (e) => toast('danger', 'Not verified', apiMessage(e)) },
    )

  const docReady = docNumber.trim().length >= 4 && holder.trim().length >= 2 && reason.trim().length >= 3

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Verify the customer"
      subtitle="Retrieval is locked until this passes."
      testID="verify-sheet"
      footer={
        tab === 'code' ? (
          <Button
            label="Confirm identity"
            size="lg"
            full
            disabled={code.trim().length < 4}
            loading={confirm.isPending}
            onPress={confirmCode}
            testID="verify-confirm-code"
          />
        ) : (
          <Button
            label="Record the fallback"
            size="lg"
            full
            disabled={!docReady}
            loading={confirm.isPending}
            onPress={confirmDocument}
            testID="verify-confirm-document"
          />
        )
      }
    >
      <Segmented
        value={tab}
        onChange={setTab}
        testID="verify-tab"
        options={[
          { value: 'code', label: 'One-time code' },
          { value: 'document', label: 'ID document' },
        ]}
      />

      {tab === 'code' ? (
        <>
          <Segmented
            value={channel}
            onChange={setChannel}
            testID="verify-channel"
            options={[
              { value: 'WHATSAPP', label: 'WhatsApp' },
              { value: 'EMAIL', label: 'Email' },
            ]}
          />

          <Muted>
            The code goes to the {channel === 'WHATSAPP' ? 'phone' : 'email'} recorded when the booking was made. You
            cannot type in a new one.
          </Muted>

          <Button
            label={sentTo ? 'Send again' : 'Send the code'}
            variant={sentTo ? 'secondary' : 'primary'}
            loading={send.isPending}
            onPress={sendCode}
            testID="verify-send"
          />

          {sentTo ? (
            <Notice tone="info" testID="verify-sent">
              <View className="flex-row items-center gap-2">
                <Icon name="Check" size={16} color={COLORS.info} />
                <Body className="flex-1">Sent to {sentTo}. Ask the customer to read it back.</Body>
              </View>
            </Notice>
          ) : null}

          <Field label="The four digits they read out">
            <Input
              value={code}
              onChangeText={setCode}
              placeholder="0000"
              keyboardType="number-pad"
              maxLength={6}
              testID="verify-code"
            />
          </Field>
        </>
      ) : (
        <>
          <Notice tone="warn">
            <Body>A fallback is recorded in the audit trail under your name, with the reason you give.</Body>
          </Notice>

          <Field label="Document type">
            <View className="gap-2">
              {DOC_TYPES.map((option) => (
                <OptionRow
                  key={option.value}
                  selected={docType === option.value}
                  onPress={() => setDocType(option.value)}
                  title={option.label}
                  testID={`verify-doc-${option.value}`}
                />
              ))}
            </View>
          </Field>

          <Field label="Document number" hint="Only the last 4 digits are stored.">
            <Input value={docNumber} onChangeText={setDocNumber} autoCapitalize="characters" testID="verify-doc-number" />
          </Field>

          <Field label="Name on the document">
            <Input value={holder} onChangeText={setHolder} testID="verify-doc-holder" />
          </Field>

          <Field label="Why the code could not be used" required>
            <TextArea
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. The customer changed phone and cannot receive WhatsApp"
              testID="verify-reason"
            />
          </Field>
        </>
      )}
    </Sheet>
  )
}
