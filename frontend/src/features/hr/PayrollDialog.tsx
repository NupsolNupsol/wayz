import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, UserPlus } from 'lucide-react'
import { Badge, Button, Field } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { useChargePayroll } from '@/hooks'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import type { SeasonEmployee } from '@/api/hr.api'
import type { Role } from '@/api/types'
import { ROLE_LABELS, SUGGESTED_MONTHLY } from './roles'

const money = (n: number) => `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`

export function PayrollDialog({
  open,
  onClose,
  seasonId,
  seasonName,
  months,
  employees,
}: {
  open: boolean
  onClose: () => void
  seasonId: string
  seasonName: string
  months: number
  employees: SeasonEmployee[]
}) {
  const { t } = useTranslation(['hr', 'common'])
  const chargePayroll = useChargePayroll()
  const [costs, setCosts] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(SUGGESTED_MONTHLY).map(([role, value]) => [role, String(value)])),
  )

  const pending = useMemo(() => employees.filter((e) => e.active && !e.charged), [employees])
  const alreadyCharged = employees.filter((e) => e.charged).length

  const byRole = useMemo(() => {
    const grouped = new Map<string, SeasonEmployee[]>()
    for (const person of pending) {
      grouped.set(person.role, [...(grouped.get(person.role) ?? []), person])
    }
    return [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [pending])

  const monthlyOf = (role: string) => Number(costs[role] ?? 0)
  const total = byRole.reduce((sum, [role, people]) => sum + monthlyOf(role) * months * people.length, 0)
  const priced = pending.filter((p) => monthlyOf(p.role) > 0).length

  const submit = () => {
    const monthlyCostByRole = Object.fromEntries(
      byRole.map(([role]) => [role, monthlyOf(role)]),
    ) as Partial<Record<Role, number>>

    chargePayroll.mutate(
      { seasonId, months, monthlyCostByRole },
      {
        onSuccess: (res) => {
          if (res.charged === 0) {
            toast(
              'warning',
              'Nothing was charged',
              res.alreadyCharged
                ? `All ${res.alreadyCharged} employees are already on ${res.seasonName}.`
                : 'Give at least one role a monthly cost above zero.',
            )
            return
          }
          toast(
            'success',
            `${res.charged} employee${res.charged === 1 ? '' : 's'} charged to ${res.seasonName}`,
            `${money(res.totalBase)} of administrative charges over ${res.months} months.`,
          )
          onClose()
        },
        onError: (e) => toast('danger', 'Could not charge', e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
      },
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('payroll.title')}
      subtitle={`${seasonName} · ${months} months. Each person is charged once; anyone already on the season is left alone.`}
      size="lg"
      testId="hr-payroll-modal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={chargePayroll.isPending} disabled={!priced} data-testid="hr-payroll-submit">
            {priced ? t('payroll.chargeCount', { count: priced, total: money(total) }) : t('payroll.nothingToCharge')}
          </Button>
        </>
      }
    >
      {alreadyCharged > 0 && (
        <div className="flex items-start gap-2 mb-4 text-sm" data-testid="payroll-already">
          <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" />
          <p className="text-muted">
            <strong className="text-navy dark:text-dk-text">{alreadyCharged}</strong> already charged to this season —
            they are skipped, so running this again never doubles the cost.
          </p>
        </div>
      )}

      {pending.length === 0 ? (
        <div className="text-center py-6" data-testid="payroll-nobody">
          <CheckCircle2 size={28} className="text-success mx-auto mb-2" />
          <p className="font-semibold text-navy dark:text-dk-texthi">{t('payroll.allCharged')}</p>
          <p className="text-sm text-muted mt-1">{t('payroll.nothingLeft')}</p>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-2 mb-4 text-sm" data-testid="payroll-pending">
            <UserPlus size={16} className="text-brand shrink-0 mt-0.5" />
            <p className="text-muted">
              <strong className="text-navy dark:text-dk-text">{pending.length}</strong> employee
              {pending.length === 1 ? '' : 's'} will be charged. Set the monthly cost per role — it is multiplied by the{' '}
              {months} months of the season.
            </p>
          </div>

          <div className="space-y-3">
            {byRole.map(([role, people]) => (
              <div
                key={role}
                className="grid grid-cols-[1fr_auto] items-center gap-4 pb-3 border-b border-line dark:border-dk-border last:border-0"
                data-testid={`payroll-role-${role}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy dark:text-dk-texthi flex items-center gap-2">
                    {ROLE_LABELS[role] ?? role}
                    <Badge tone="info">{people.length}</Badge>
                  </p>
                  <p className="text-[11px] text-muted truncate">{people.map((p) => p.fullName).join(', ')}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Field label={t('payroll.monthly')} className="mb-0">
                    <input
                      type="number"
                      min={0}
                      step="100"
                      className="lf-input tabular-nums w-32"
                      value={costs[role] ?? ''}
                      onChange={(e) => setCosts({ ...costs, [role]: e.target.value })}
                      data-testid={`hr-payroll-${role}`}
                    />
                  </Field>
                  <div className="text-end w-32">
                    <p className="text-[11px] uppercase tracking-wide text-muted font-semibold">{t('payroll.seasonTotal')}</p>
                    <p className="tabular-nums font-semibold text-navy dark:text-dk-texthi">
                      {(monthlyOf(role) * months * people.length).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t-2 border-line dark:border-dk-border">
            <span className="font-semibold text-navy dark:text-dk-texthi">{t('payroll.addedToCostBase')}</span>
            <span className="text-xl font-bold tabular-nums" data-testid="payroll-total">{money(total)}</span>
          </div>
        </>
      )}
    </Modal>
  )
}
