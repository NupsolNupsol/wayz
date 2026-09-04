import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Banknote } from 'lucide-react'
import { Button, Card, SectionTitle } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { PaymentPanel, type PaymentSplit } from '@/components/PaymentPanel'
import { useBookingOrder, useRefundPosition, useSettleBooking } from '@/hooks'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { money } from '@/utils'
import { sendInvoiceOnPayment } from '@/features/invoice/sendInvoiceOnPayment'

export function AmountDuePanel({
  bookingId,
  overtime,
  openSignal = 0,
  onDueChange,
  blockedReason,
}: {
  bookingId: string
  overtime?: { isOvertime: boolean; chargeableHours: number; penaltyAmount: number } | null
  openSignal?: number
  onDueChange?: (due: number) => void
  blockedReason?: string | null
}) {
  const { t } = useTranslation(['bookings', 'common'])
  const { data: order } = useBookingOrder(bookingId)
  const { data: position } = useRefundPosition(bookingId)
  const settle = useSettleBooking()
  const [open, setOpen] = useState(false)

  const pendingOvertime = useMemo(() => {
    if (!overtime?.isOvertime || overtime.penaltyAmount <= 0) return 0
    const charged = (order?.lines ?? [])
      .filter((l) => l.productId === 'OVERTIME_PENALTY')
      .reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
    return Math.round(Math.max(0, overtime.penaltyAmount - charged) * 100) / 100
  }, [order, overtime])

  const due = useMemo(() => {
    if (!order) return 0
    const paid = position?.paid ?? 0
    return Math.round((Math.max(0, order.total - paid) + pendingOvertime) * 100) / 100
  }, [order, position, pendingOvertime])

  useEffect(() => onDueChange?.(due), [due, onDueChange])

  const handledSignal = useRef(openSignal)
  const [asked, setAsked] = useState(false)
  useEffect(() => {
    if (openSignal > handledSignal.current) {
      handledSignal.current = openSignal
      setAsked(true)
    }
  }, [openSignal])
  useEffect(() => {
    if (asked && due > 0 && !blockedReason) {
      setOpen(true)
      setAsked(false)
    }
  }, [asked, due, blockedReason])

  if (due <= 0 && !open) return null

  const collect = (splits: PaymentSplit[]) => {
    settle.mutate(
      { id: bookingId, splits: splits.map((s) => ({ method: s.method, cardScheme: s.cardScheme ?? null, amount: s.amount })) },
      {
        onSuccess: (r) => {
          toast('success', t('due.collected'), t('due.collectedDetail', { amount: money(r.collected) }))
          setOpen(false)
          void sendInvoiceOnPayment(bookingId)
        },
        onError: (e) => toast('danger', t('due.failed'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  const extras = (order?.lines ?? []).filter((l) =>
    ['OVERTIME_PENALTY', 'WRONG_STATION_PENALTY'].includes(l.productId) || l.productId.startsWith('EXTENSION'),
  )

  return (
    <>
      {due > 0 && (
      <Card key="amount-due" className="border-amber-400 bg-amber-50 dark:bg-amber-900/20" data-testid="amount-due">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionTitle className="flex items-center gap-2">
              <Banknote size={17} className="text-amber-600" /> {t('due.title')}
            </SectionTitle>
            <p className="text-2xl font-bold text-navy dark:text-dk-texthi mt-1 tabular-nums" data-testid="amount-due-value">
              {money(due)}
            </p>
            {(extras.length > 0 || pendingOvertime > 0) && (
              <ul className="text-xs text-muted mt-2 flex flex-col gap-0.5" data-testid="amount-due-lines">
                {pendingOvertime > 0 && (
                  <li className="flex justify-between gap-4">
                    <span>{t('due.overtimeRunning', { count: overtime?.chargeableHours ?? 1 })}</span>
                    <span className="tabular-nums">{money(pendingOvertime)}</span>
                  </li>
                )}
                {extras.map((l, i) => (
                  <li key={i} className="flex justify-between gap-4">
                    <span>{l.name}</span>
                    <span className="tabular-nums">{money(l.unitPrice * l.quantity)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button
            onClick={() => setOpen(true)}
            disabled={!!blockedReason}
            title={blockedReason ?? undefined}
            data-testid="amount-due-collect"
          >
            {t('due.collect')}
          </Button>
        </div>
      </Card>

      )}

      <Modal
        key="settle"
        open={open}
        onClose={() => setOpen(false)}
        title={t('due.collectTitle')}
        subtitle={t('due.collectSubtitle', { amount: money(due) })}
        testId="settle-modal"
      >
        <PaymentPanel total={due} onConfirm={collect} confirming={settle.isPending} />
      </Modal>
    </>
  )
}
