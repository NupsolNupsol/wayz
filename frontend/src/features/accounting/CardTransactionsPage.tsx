import { useState } from 'react'
import { useStatusLabel } from '@/i18n/useStatusLabel'
import { useTranslation } from 'react-i18next'
import { Import } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, Field, Spinner } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { RefLink } from '@/components/RefLink'
import { Modal } from '@/components/Modal'
import { Select } from '@/components/Select'
import { useCardTransactions, useIngestTransactions } from '@/hooks'
import { ApiError } from '@/api/client'
import { toast } from '@/state/toastStore'
import { TRANSACTION_SOURCES, type CardTransaction, type RawTransaction, type TransactionSource } from '@/api/accounting.api'
import { CARD_SCHEMES, type CardScheme } from '@/config/cardSchemes'
import { PeriodBar } from './SettlementShared'
import { isoDaysAgo, money, schemeLabel } from './settlement'

const SAMPLE_FEED = `[
  {
    "externalRef": "RRN900001",
    "scheme": "VISA CARD",
    "grossAmount": 345.00,
    "capturedAt": "${new Date().toISOString().slice(0, 10)}",
    "terminalId": "TPE-RIYADH-01",
    "maskedPan": "4539********1234",
    "authCode": "104582",
    "engineKind": "LAGOON"
  }
]`

export function CardTransactionsPage() {
  const { t } = useTranslation(['accounting', 'common'])
  const statusLabel = useStatusLabel()
  const [from, setFrom] = useState(isoDaysAgo(30))
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))
  const [scheme, setScheme] = useState<'' | CardScheme>('')

  const filter = { from, to, ...(scheme ? { scheme } : {}) }
  const { data: rows = [], isLoading } = useCardTransactions(filter)
  const ingest = useIngestTransactions()

  const [importing, setImporting] = useState(false)
  const [feed, setFeed] = useState(SAMPLE_FEED)
  const [source, setSource] = useState<TransactionSource>('ETL')
  const [parseError, setParseError] = useState('')

  const submitImport = () => {
    let parsed: RawTransaction[]
    try {
      const value = JSON.parse(feed)
      parsed = Array.isArray(value) ? value : [value]
    } catch {
      setParseError('That is not valid JSON. Paste the rows exactly as the feed produces them.')
      return
    }
    if (!parsed.length) {
      setParseError('Send at least one transaction.')
      return
    }
    setParseError('')

    ingest.mutate(
      { transactions: parsed, source },
      {
        onSuccess: (res) => {
          toast(
            res.imported ? 'success' : 'warning',
            `${res.imported} of ${res.received} imported`,
            [
              res.duplicates ? `${res.duplicates} already known` : '',
              res.rejected.length ? `${res.rejected.length} rejected` : '',
              res.imported ? `commission ${money(res.commissionAmount)}` : '',
            ]
              .filter(Boolean)
              .join(' · '),
          )
          if (!res.rejected.length) setImporting(false)
          else setParseError(res.rejected.map((r) => `${r.externalRef || '(no reference)'}: ${r.reason}`).join('\n'))
        },
        onError: (e) => setParseError(e instanceof ApiError ? (e.errors?.join(' ') ?? e.message) : 'Import failed.'),
      },
    )
  }

  return (
    <div data-testid="transactions-page">
      <PageHeader
        title={t('transactions.title')}
        subtitle={t('transactions.subtitle')}
        crumbs={[{ label: t('common:crumb.accounting') }, { label: t('common:crumb.settlement') }, { label: t('common:crumb.transactions') }]}
        helpId="accounting-transactions"
        actions={
          <Button onClick={() => setImporting(true)} data-testid="transactions-import">
            <Import size={16} />{t('transactions.importFeed')}</Button>
        }
      />

      <Card className="p-3 mb-4">
        <PeriodBar from={from} to={to} onFrom={setFrom} onTo={setTo} scheme={scheme} onScheme={setScheme} testId="transactions" />
      </Card>

      {isLoading && !rows.length && (
        <div className="mb-4">
          <Spinner label={t('transactions.reading')} />
        </div>
      )}

      <DataTable
        testId="transactions-table"
        rows={rows}
        keyOf={(r: CardTransaction) => r._id}
        pageSize={15}
        initialSort={{ key: 'when', dir: 'desc' }}
        empty={{ title: t('cards.noRows'), message: t('cards.noRowsHint') }}
        columns={[
          {
            key: 'ref',
            header: t('common:column.reference'),
            sortValue: (r: CardTransaction) => r.externalRef,
            filter: { kind: 'text', value: (r: CardTransaction) => `${r.externalRef} ${r.authCode} ${r.maskedPan}` },
            render: (r: CardTransaction) => (
              <div>
                <RefLink to={`/accounting/settlement/transactions/${r._id}`} testId={`txn-ref-${r._id}`}>
                  {r.externalRef}
                </RefLink>
                <p className="text-[11px] text-muted font-mono">{r.maskedPan || r.terminalId}</p>
              </div>
            ),
          },
          {
            key: 'when',
            header: t('common:column.captured'),
            sortValue: (r: CardTransaction) => r.capturedAt,
            render: (r: CardTransaction) => <span className="tabular-nums text-sm">{r.capturedAt.slice(0, 10)}</span>,
          },
          {
            key: 'scheme',
            header: t('common:column.card'),
            filter: {
              kind: 'select',
              options: CARD_SCHEMES.map((s) => ({ label: schemeLabel(s), value: s })),
              value: (r: CardTransaction) => r.scheme,
            },
            render: (r: CardTransaction) => <Badge tone="info">{schemeLabel(r.scheme)}</Badge>,
          },
          {
            key: 'source',
            header: t('common:column.source'),
            filter: {
              kind: 'select',
              options: TRANSACTION_SOURCES.map((s) => ({ label: s, value: s })),
              value: (r: CardTransaction) => r.source,
            },
            render: (r: CardTransaction) => <span className="text-xs text-muted">{r.source}</span>,
          },
          {
            key: 'gross',
            header: t('common:column.gross'),
            align: 'right',
            sortValue: (r: CardTransaction) => r.grossAmount,
            render: (r: CardTransaction) => <span className="tabular-nums">{r.grossAmount.toFixed(2)}</span>,
          },
          {
            key: 'rate',
            header: t('common:column.rate'),
            align: 'right',
            sortValue: (r: CardTransaction) => r.commissionRate,
            render: (r: CardTransaction) => <span className="tabular-nums text-muted">{(r.commissionRate * 100).toFixed(2)}%</span>,
          },
          {
            key: 'commission',
            header: t('common:column.commission'),
            align: 'right',
            sortValue: (r: CardTransaction) => r.commissionAmount,
            render: (r: CardTransaction) => <span className="tabular-nums text-danger-strong">{r.commissionAmount.toFixed(2)}</span>,
          },
          {
            key: 'net',
            header: t('common:column.netsettled'),
            align: 'right',
            sortValue: (r: CardTransaction) => r.netSettled,
            render: (r: CardTransaction) => <strong className="tabular-nums">{r.netSettled.toFixed(2)}</strong>,
          },
          {
            key: 'status',
            header: t('common:column.status'),
            filter: {
              kind: 'select',
              options: ['CAPTURED', 'SETTLED', 'REFUNDED', 'REVERSED'].map((s) => ({ label: s, value: s })),
              value: (r: CardTransaction) => r.status,
            },
            render: (r: CardTransaction) => (
              <Badge tone={r.status === 'SETTLED' ? 'success' : r.status === 'CAPTURED' ? 'info' : 'warning'}>{statusLabel(r.status, 'payment')}</Badge>
            ),
          },
        ]}
      />

      <Modal
        open={importing}
        onClose={() => setImporting(false)}
        title={t('cards.importTitle')}
        subtitle={t('transactions.sourceNote')}
        size="lg"
        testId="import-modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setImporting(false)}>{t('common:action.cancel')}</Button>
            <Button onClick={submitImport} loading={ingest.isPending} data-testid="import-submit">{t('transactions.import')}</Button>
          </>
        }
      >
        <Field label={t('transactions.whereFrom')}>
          <Select
            value={source}
            onChange={(v) => setSource(v as TransactionSource)}
            options={[
              { label: t('common:label.tpereadstraightoffthepaymentterminal'), value: 'TPE' },
              { label: t('common:label.etlanightlyextractfromtheacquirer'), value: 'ETL' },
              { label: t('common:label.manualkeyedinbyhand'), value: 'MANUAL' },
            ]}
            testId="import-source"
          />
        </Field>

        <Field
          label={t('transactions.rows')}
          required
          hint="An array of objects. externalRef, scheme and grossAmount are required; the rest is optional. Re-importing the same reference is ignored, so a feed can be replayed safely."
        >
          <textarea
            className="lf-input font-mono text-xs min-h-[220px]"
            value={feed}
            onChange={(e) => setFeed(e.target.value)}
            data-testid="import-feed"
          />
        </Field>

        {parseError && (
          <p className="text-sm text-danger-strong whitespace-pre-wrap" data-testid="import-error">
            {parseError}
          </p>
        )}
      </Modal>
    </div>
  )
}
