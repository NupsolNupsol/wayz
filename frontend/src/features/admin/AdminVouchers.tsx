import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Download, Plus, Ticket } from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/PageHeader'
import { Button, Card, Field, SectionTitle, Spinner, Badge } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { NumberInput } from '@/components/NumberInput'
import { adminApi } from '@/api/admin.api'
import type { CampaignInput, VoucherCampaign, VoucherCode } from '@/api/admin.api'
import { visibleEngineOptions, engineLabel } from '@/config/engineMeta'
import { toast } from '@/state/toastStore'
import { ApiError } from '@/api/client'
import { formatDate } from '@/utils'
import type { EngineKind } from '@/api/types'

const blank = (): CampaignInput => ({ name: '', percent: 10, quantity: 100, engineKinds: [], expiresAt: null, prefix: 'WZ' })

export function AdminVouchers() {
  const { t } = useTranslation(['admin', 'common'])
  const qc = useQueryClient()
  const { data: campaigns = [], isLoading } = useQuery({ queryKey: ['admin', 'vouchers'], queryFn: adminApi.vouchers })

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CampaignInput>(blank())
  const [viewing, setViewing] = useState<VoucherCampaign | null>(null)

  const create = useMutation({
    mutationFn: (input: CampaignInput) => adminApi.createVouchers(input),
    onSuccess: (campaign) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'vouchers'] })
      setOpen(false)
      setForm(blank())
      toast('success', t('vouchers.created', { count: campaign.quantity }), campaign.name)
    },
    onError: (e) => toast('danger', t('vouchers.failed'), e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : ''),
  })

  const stop = useMutation({
    mutationFn: (id: string) => adminApi.stopVouchers(id),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'vouchers'] })
      setViewing(null)
      toast('success', t('vouchers.stopped', { count: res.stopped }))
    },
  })

  const toggleEngine = (kind: EngineKind) => {
    const list = form.engineKinds ?? []
    setForm({ ...form, engineKinds: list.includes(kind) ? list.filter((k) => k !== kind) : [...list, kind] })
  }

  if (isLoading) {
    return (
      <div data-testid="admin-vouchers">
        <PageHeader title={t('vouchers.title')} subtitle={t('common:state.loading')} />
        <Spinner />
      </div>
    )
  }

  return (
    <div data-testid="admin-vouchers">
      <PageHeader
        title={t('vouchers.title')}
        subtitle={t('vouchers.subtitle')}
        actions={
          <Button onClick={() => setOpen(true)} data-testid="voucher-batch-new">
            <Plus size={15} /> {t('vouchers.new')}
          </Button>
        }
      />

      <Card>
        <DataTable<VoucherCampaign>
          testId="voucher-campaigns"
          rows={campaigns}
          keyOf={(c) => c.id}
          onRowClick={(c) => setViewing(c)}
          empty={{ title: t('vouchers.emptyTitle'), message: t('vouchers.emptyBody') }}
          initialSort={{ key: 'createdAt', dir: 'desc' }}
          columns={[
            {
              key: 'name',
              header: t('vouchers.col.name'),
              render: (c) => (
                <span className="font-semibold flex items-center gap-2">
                  <Ticket size={14} className="text-brand" /> {c.name}
                </span>
              ),
              sortValue: (c) => c.name,
            },
            {
              key: 'percent',
              header: t('vouchers.col.percent'),
              align: 'right',
              render: (c) => <span className="font-bold">{c.percent}%</span>,
              sortValue: (c) => c.percent,
            },
            {
              key: 'engines',
              header: t('vouchers.col.where'),
              render: (c) =>
                c.engineKinds.length === 0 ? (
                  <span className="text-muted">{t('vouchers.anyActivity')}</span>
                ) : (
                  <span>{c.engineKinds.map((k) => engineLabel(k)).join(', ')}</span>
                ),
            },
            {
              key: 'used',
              header: t('vouchers.col.used'),
              align: 'right',
              render: (c) => (
                <span>
                  {c.redeemed} / {c.issued}
                </span>
              ),
              sortValue: (c) => c.redeemed,
            },
            {
              key: 'expiresAt',
              header: t('vouchers.col.expires'),
              render: (c) => (c.expiresAt ? formatDate(new Date(c.expiresAt).getTime()) : <span className="text-muted">—</span>),
              sortValue: (c) => c.expiresAt ?? '',
            },
            {
              key: 'createdAt',
              header: t('vouchers.col.created'),
              render: (c) => formatDate(new Date(c.createdAt).getTime()),
              sortValue: (c) => c.createdAt,
            },
            {
              key: 'status',
              header: t('common:field.status'),
              render: (c) =>
                c.active ? <Badge tone="success">{t('vouchers.live')}</Badge> : <Badge tone="neutral">{t("vouchers.stoppedTag")}</Badge>,
            },
          ]}
        />
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('vouchers.newTitle')}
        subtitle={t('vouchers.newSubtitle')}
        testId="voucher-batch-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common:action.cancel')}
            </Button>
            <Button
              onClick={() => create.mutate(form)}
              loading={create.isPending}
              disabled={form.name.trim().length < 2 || form.quantity < 1 || form.percent < 1}
              data-testid="voucher-batch-create"
            >
              <Ticket size={15} /> {t('vouchers.mint', { count: form.quantity })}
            </Button>
          </>
        }
      >
        <Field label={t('vouchers.field.name')} hint={t('vouchers.field.nameHint')}>
          <input
            className="lf-input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            data-testid="voucher-name"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('vouchers.field.quantity')}>
            <NumberInput
              value={form.quantity}
              min={1}
              max={5000}
              onChange={(v) => setForm({ ...form, quantity: v })}
              testId="voucher-quantity"
            />
          </Field>
          <Field label={t('vouchers.field.percent')}>
            <NumberInput
              value={form.percent}
              min={1}
              max={100}
              onChange={(v) => setForm({ ...form, percent: v })}
              testId="voucher-percent"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('vouchers.field.prefix')} hint={t('vouchers.field.prefixHint')}>
            <input
              className="lf-input font-mono uppercase"
              value={form.prefix ?? ''}
              maxLength={6}
              onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase() })}
              data-testid="voucher-prefix"
            />
          </Field>
          <Field label={t('vouchers.field.expires')} hint={t('vouchers.field.expiresHint')}>
            <input
              type="date"
              className="lf-input"
              value={form.expiresAt ?? ''}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value || null })}
              data-testid="voucher-expires"
            />
          </Field>
        </div>

        <p className="text-xs uppercase tracking-wider text-muted font-bold mb-2 mt-1">{t('vouchers.field.activities')}</p>
        <div className="flex flex-wrap gap-2" data-testid="voucher-engines">
          {visibleEngineOptions().map((opt) => {
            const on = (form.engineKinds ?? []).includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleEngine(opt.value)}
                data-testid={`voucher-engine-${opt.value}`}
                className={clsx(
                  'lf-btn !h-9 !px-3 text-xs border',
                  on ? 'bg-brand text-brand-fg border-brand' : 'bg-surface border-line text-muted hover:text-brand',
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted mt-2">{t('vouchers.field.activitiesHint')}</p>
      </Modal>

      {viewing && <CodeSheet campaign={viewing} onClose={() => setViewing(null)} onStop={() => stop.mutate(viewing.id)} stopping={stop.isPending} />}
    </div>
  )
}

function CodeSheet({
  campaign,
  onClose,
  onStop,
  stopping,
}: {
  campaign: VoucherCampaign
  onClose: () => void
  onStop: () => void
  stopping: boolean
}) {
  const { t } = useTranslation(['admin', 'common'])
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'vouchers', campaign.id],
    queryFn: () => adminApi.voucherCodes(campaign.id),
  })

  const download = () => {
    if (!data) return
    const rows = [['code', 'status', 'redeemedAt', 'amountOff'].join(',')]
    for (const c of data.codes) rows.push([c.code, c.status, c.redeemedAt ?? '', c.amountOff ?? ''].join(','))
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${campaign.name.replace(/\s+/g, '-').toLowerCase()}-codes.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={campaign.name}
      subtitle={t('vouchers.sheetSubtitle', { percent: campaign.percent, count: campaign.issued })}
      testId="voucher-codes-modal"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common:action.close')}
          </Button>
          <Button variant="secondary" onClick={download} disabled={!data} data-testid="voucher-codes-export">
            <Download size={15} /> {t('vouchers.export')}
          </Button>
          {campaign.active && (
            <Button variant="danger" onClick={onStop} loading={stopping} data-testid="voucher-stop">
              <Ban size={15} /> {t('vouchers.stop')}
            </Button>
          )}
        </>
      }
    >
      {isLoading || !data ? (
        <Spinner />
      ) : (
        <>
          <SectionTitle className="mb-2">{t('vouchers.codes')}</SectionTitle>
          <div className="max-h-[46vh] overflow-y-auto scroll-thin grid grid-cols-2 md:grid-cols-3 gap-2" data-testid="voucher-code-list">
            {data.codes.map((c: VoucherCode) => (
              <div
                key={c.id}
                data-testid={`voucher-code-${c.code}`}
                className={clsx(
                  'rounded-lg border px-2.5 py-2 text-xs font-mono tracking-wider flex items-center justify-between gap-2',
                  c.status === 'REDEEMED' && 'border-line bg-canvas text-muted line-through',
                  c.status === 'VOID' && 'border-line bg-canvas text-muted opacity-60',
                  c.status === 'ISSUED' && 'border-brand/30 bg-brand/5 text-navy dark:text-dk-texthi',
                )}
              >
                <span>{c.code}</span>
                {c.status === 'REDEEMED' && <span className="text-[10px] not-italic">{t('vouchers.used')}</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}
