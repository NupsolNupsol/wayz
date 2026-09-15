import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import {
  BookOpenCheck,
  Building2,
  FileText,
  Globe,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  Youtube,
} from 'lucide-react'

import {
  DataTable,
  EmptyState,
  ErrorState,
  Labelled,
  PageHeader,
  Pill,
  PlatformButton,
  PlatformCard,
  Skeleton,
  Td,
  TextInput,
  Th,
  when,
} from '../components'
import { ConfirmDialog, useToast } from '../toast'
import { knowledgeApi, type KnowledgeDocument, type KnowledgeScope } from '../knowledgeApi'
import { ApiError } from '@/api/client'

/**
 * The knowledge base behind the employee assistant.
 *
 * The single most important thing this screen does is make it hard to publish one company's
 * private procedure to every company on the platform. So the scope is not a dropdown buried in
 * a form — it is a two-way switch at the top that changes what the whole page is about, the
 * tenant picker only exists on one side of it, and the badge on every row says plainly whose
 * document it is. Uploading to a tenant without choosing one is not possible, and the server
 * refuses it independently.
 */

const MAX_FILE_BYTES = 2 * 1024 * 1024

export function PlatformKnowledgePage() {
  const { say } = useToast()
  const queryClient = useQueryClient()

  const [scope, setScope] = useState<KnowledgeScope>('GLOBAL')
  const [tenantId, setTenantId] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<KnowledgeDocument | null>(null)

  const vocabulary = useQuery({ queryKey: ['knowledge', 'vocabulary'], queryFn: knowledgeApi.vocabulary })

  const listKey = ['knowledge', 'documents', scope, scope === 'TENANT' ? tenantId : '']
  const documents = useQuery({
    queryKey: listKey,
    queryFn: () => knowledgeApi.list({ scope, tenantId }),
    // A tenant list with no tenant chosen would be every tenant's documents at once, which
    // is exactly the confusion this screen exists to prevent.
    enabled: scope === 'GLOBAL' || Boolean(tenantId),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['knowledge', 'documents'] })

  const reindex = useMutation({
    mutationFn: knowledgeApi.reindex,
    onSuccess: (result) => {
      say(
        result.status === 'INDEXED'
          ? `Re-indexed — ${result.chunk_count} chunk(s).`
          : `Indexing failed: ${result.error ?? 'unknown error'}`,
        result.status === 'INDEXED' ? 'good' : 'bad',
      )
      void invalidate()
    },
    onError: (error) => say(error instanceof ApiError ? error.message : 'Could not re-index.', 'bad'),
  })

  const remove = useMutation({
    mutationFn: knowledgeApi.remove,
    onSuccess: () => {
      say('Document deleted. Its vectors are gone from the index.')
      setPendingDelete(null)
      void invalidate()
    },
    onError: (error) => say(error instanceof ApiError ? error.message : 'Could not delete.', 'bad'),
  })

  const tenants = vocabulary.data?.tenants ?? []
  const tenantName = tenants.find((t) => t.id === tenantId)?.name ?? ''
  const rows = documents.data?.items ?? []

  if (vocabulary.data && !vocabulary.data.enabled) {
    return (
      <>
        <PageHeader
          title="Knowledge base"
          blurb="The Arabic documentation the employee AI assistant answers from."
        />
        <EmptyState
          icon={BookOpenCheck}
          title="The learning AI service is not configured"
          blurb="Set AI_SERVICE_SECRET and AI_SERVICE_URL in backend/.env, then start the learning-ai service with docker compose up -d."
          testId="knowledge-disabled"
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Knowledge base"
        blurb="The Arabic documentation the employee AI assistant answers from. Global documents describe LockerFlow itself; tenant documents are one company's own procedures and are never retrievable by anybody else."
        testId="knowledge-header"
      />

      <ScopeSwitch scope={scope} onChange={setScope} />

      <div className="grid gap-5 xl:grid-cols-[360px_1fr] items-start">
        <UploadPanel
          scope={scope}
          tenantId={tenantId}
          tenantName={tenantName}
          tenants={tenants}
          roles={vocabulary.data?.roles ?? []}
          onTenantChange={setTenantId}
          onUploaded={() => void invalidate()}
        />

        <PlatformCard testId="knowledge-list">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
              {scope === 'GLOBAL' ? 'Global documents' : `Documents for ${tenantName || 'a tenant'}`}
            </h2>
            <span className="text-[11px] text-muted">{documents.data?.total ?? 0} total</span>
          </div>

          {scope === 'TENANT' && !tenantId ? (
            <EmptyState
              icon={Building2}
              title="Choose a company"
              blurb="Tenant knowledge is shown one company at a time — there is no view that mixes them."
              testId="knowledge-pick-tenant"
            />
          ) : documents.isLoading ? (
            <Skeleton rows={4} />
          ) : documents.isError ? (
            <ErrorState
              message={
                documents.error instanceof ApiError
                  ? documents.error.message
                  : 'Could not load documents.'
              }
              onRetry={() => void documents.refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents yet"
              blurb="Upload an Arabic .txt describing one workflow. One file per feature works best."
              testId="knowledge-empty"
            />
          ) : (
            <DataTable
              testId="knowledge-table"
              head={
                <>
                  <Th>Document</Th>
                  <Th>Scope</Th>
                  <Th>Access</Th>
                  <Th>Index</Th>
                  <Th className="text-end">Actions</Th>
                </>
              }
            >
              {rows.map((doc) => (
                <tr key={doc.id} className="hover:bg-canvas" data-testid={`knowledge-row-${doc.id}`}>
                  <Td>
                    <button
                      type="button"
                      onClick={() => setPreview(preview === doc.id ? null : doc.id)}
                      className="text-start"
                      data-testid={`knowledge-preview-${doc.id}`}
                    >
                      <span className="block font-semibold text-ink" dir="auto">
                        {doc.title}
                      </span>
                      <span className="block text-[11px] text-muted">
                        {doc.filename} · {doc.module} · v{doc.version}
                        {doc.page_key ? ` · ${doc.page_key}` : ''}
                      </span>
                    </button>
                    {doc.video_urls.length > 0 && (
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {doc.video_urls.map((url) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-danger-strong hover:underline"
                          >
                            <Youtube size={11} /> video
                          </a>
                        ))}
                      </span>
                    )}
                    {preview === doc.id && <Preview id={doc.id} />}
                  </Td>
                  <Td>
                    <Pill tone={doc.scope === 'TENANT' ? 'live' : 'info'} testId={`knowledge-scope-${doc.id}`}>
                      {doc.scope === 'TENANT' ? (
                        <>
                          <Building2 size={11} /> {doc.tenant_name ?? doc.tenant_id}
                        </>
                      ) : (
                        <>
                          <Globe size={11} /> GLOBAL
                        </>
                      )}
                    </Pill>
                  </Td>
                  <Td>
                    {doc.allowed_roles.length === 0 ? (
                      <span className="text-[11px] text-muted">All roles</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {doc.allowed_roles.map((role) => (
                          <Pill key={role}>{role}</Pill>
                        ))}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <Pill
                      tone={
                        doc.status === 'INDEXED' ? 'live' : doc.status === 'FAILED' ? 'bad' : 'warn'
                      }
                      testId={`knowledge-status-${doc.id}`}
                    >
                      {doc.status}
                    </Pill>
                    <span className="block text-[11px] text-muted mt-1">
                      {doc.status === 'INDEXED'
                        ? `${doc.chunk_count} chunk(s) · ${when(doc.indexed_at)}`
                        : (doc.error ?? '—')}
                    </span>
                  </Td>
                  <Td className="text-end whitespace-nowrap">
                    <button
                      onClick={() => reindex.mutate(doc.id)}
                      disabled={reindex.isPending}
                      title="Re-index"
                      data-testid={`knowledge-reindex-${doc.id}`}
                      className="p-2 rounded-lg text-muted hover:text-ink hover:bg-canvas disabled:opacity-40"
                    >
                      <RefreshCw size={14} className={clsx(reindex.isPending && 'animate-spin')} />
                    </button>
                    <button
                      onClick={() => setPendingDelete(doc)}
                      title="Delete"
                      data-testid={`knowledge-delete-${doc.id}`}
                      className="p-2 rounded-lg text-danger-strong/70 hover:text-danger-strong hover:bg-rose-500/10"
                    >
                      <Trash2 size={14} />
                    </button>
                  </Td>
                </tr>
              ))}
            </DataTable>
          )}
        </PlatformCard>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this document?"
        body={
          <>
            <p>
              <strong className="text-ink">{pendingDelete?.title}</strong> will be removed from
              the catalogue and its vectors deleted from the index.
            </p>
            <p>The assistant will stop answering from it immediately. This cannot be undone.</p>
          </>
        }
        confirmLabel="Delete"
        tone="danger"
        busy={remove.isPending}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
        testId="knowledge-confirm-delete"
      />
    </>
  )
}

function ScopeSwitch({
  scope,
  onChange,
}: {
  scope: KnowledgeScope
  onChange: (scope: KnowledgeScope) => void
}) {
  const options: { value: KnowledgeScope; label: string; blurb: string; icon: typeof Globe }[] = [
    {
      value: 'GLOBAL',
      label: 'Global knowledge',
      blurb: 'LockerFlow itself. Every company can read it.',
      icon: Globe,
    },
    {
      value: 'TENANT',
      label: 'Tenant knowledge',
      blurb: "One company's own procedures. Nobody else can read it.",
      icon: Building2,
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 mb-5" data-testid="knowledge-scope-switch">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          data-testid={`knowledge-scope-${option.value.toLowerCase()}`}
          className={clsx(
            'rounded-2xl border p-4 text-start transition-colors flex items-start gap-3',
            scope === option.value
              ? 'bg-brand/10 border-sky-300/40'
              : 'bg-canvas border-line hover:bg-canvas',
          )}
        >
          <span
            className={clsx(
              'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
              scope === option.value ? 'bg-sky-400/20 text-brand' : 'bg-canvas text-muted',
            )}
          >
            <option.icon size={17} />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-[13px]">{option.label}</span>
            <span className="block text-[11px] text-muted mt-0.5">{option.blurb}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

function Preview({ id }: { id: string }) {
  const detail = useQuery({ queryKey: ['knowledge', 'document', id], queryFn: () => knowledgeApi.detail(id) })
  return (
    <div className="mt-2 rounded-xl bg-black/25 border border-line p-3" data-testid="knowledge-preview">
      {detail.isLoading ? (
        <span className="text-[11px] text-muted">Loading…</span>
      ) : detail.isError ? (
        <span className="text-[11px] text-danger-strong">Could not load the document.</span>
      ) : (
        <pre
          dir="rtl"
          className="text-[12px] text-muted whitespace-pre-wrap font-sans max-h-56 overflow-y-auto leading-relaxed"
        >
          {detail.data?.content}
        </pre>
      )}
    </div>
  )
}

function UploadPanel({
  scope,
  tenantId,
  tenantName,
  tenants,
  roles,
  onTenantChange,
  onUploaded,
}: {
  scope: KnowledgeScope
  tenantId: string
  tenantName: string
  tenants: { id: string; name: string; lifecycle: string }[]
  roles: string[]
  onTenantChange: (id: string) => void
  onUploaded: () => void
}) {
  const { say } = useToast()
  const [title, setTitle] = useState('')
  const [module, setModule] = useState('GENERAL')
  const [pageKey, setPageKey] = useState('')
  const [allowedRoles, setAllowedRoles] = useState<string[]>([])
  const [file, setFile] = useState<{ name: string; content: string } | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: knowledgeApi.create,
    onSuccess: (doc) => {
      say(
        doc.status === 'INDEXED'
          ? `Indexed — ${doc.chunk_count} chunk(s)${doc.video_urls.length ? `, ${doc.video_urls.length} video(s) found` : ''}.`
          : `Saved but not indexed: ${doc.error ?? 'unknown error'}`,
        doc.status === 'INDEXED' ? 'good' : 'bad',
      )
      setTitle('')
      setPageKey('')
      setFile(null)
      setAllowedRoles([])
      onUploaded()
    },
    onError: (error) => say(error instanceof ApiError ? error.message : 'Upload failed.', 'bad'),
  })

  const ready = useMemo(
    () => Boolean(title.trim() && file && (scope === 'GLOBAL' || tenantId)),
    [title, file, scope, tenantId],
  )

  const readFile = async (picked: File | undefined) => {
    setProblem(null)
    if (!picked) return
    if (!/\.(txt|md)$/i.test(picked.name)) {
      setProblem('Only .txt (or .md) files are accepted.')
      return
    }
    if (picked.size > MAX_FILE_BYTES) {
      setProblem(`Keep the file under ${MAX_FILE_BYTES / 1024 / 1024} MB.`)
      return
    }
    const content = await picked.text()
    if (!content.trim()) {
      setProblem('That file is empty.')
      return
    }
    setFile({ name: picked.name, content })
    // A document's first line is nearly always its heading, which saves retyping it.
    if (!title.trim()) setTitle(content.trim().split('\n')[0].slice(0, 120))
  }

  const videosFound = file ? (file.content.match(/youtu\.?be/gi) ?? []).length : 0

  return (
    <PlatformCard testId="knowledge-upload">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted flex-1">
          Upload a document
        </h2>
        <Pill tone={scope === 'TENANT' ? 'live' : 'info'} testId="knowledge-upload-scope">
          {scope === 'TENANT' ? (
            <>
              <Building2 size={11} /> {tenantName || 'No tenant chosen'}
            </>
          ) : (
            <>
              <Globe size={11} /> GLOBAL
            </>
          )}
        </Pill>
      </div>

      {scope === 'TENANT' && (
        <Labelled
          label="Company"
          hint="Only this company's staff will ever retrieve the document."
          problem={!tenantId ? 'Choose the company this document belongs to.' : undefined}
        >
          <select
            value={tenantId}
            onChange={(e) => onTenantChange(e.target.value)}
            data-testid="knowledge-tenant-select"
            className="w-full h-11 px-3.5 rounded-xl bg-canvas border border-line text-white outline-none focus:border-brand"
          >
            <option value="">— choose a company —</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id} className="bg-surface">
                {tenant.name}
                {tenant.lifecycle !== 'ACTIVE' ? ` (${tenant.lifecycle})` : ''}
              </option>
            ))}
          </select>
        </Labelled>
      )}

      <Labelled label="Title" hint="Shown to employees as the source of the answer.">
        <TextInput value={title} onChange={setTitle} dir="rtl" testId="knowledge-title" />
      </Labelled>

      <Labelled label="Module" hint="Which part of LockerFlow this describes.">
        <TextInput value={module} onChange={(v) => setModule(v.toUpperCase())} testId="knowledge-module" />
      </Labelled>

      <Labelled
        label="Page key (optional)"
        hint="Pins the document to one screen, e.g. agent.delivery.details — it then ranks higher when somebody asks from there."
      >
        <TextInput value={pageKey} onChange={setPageKey} testId="knowledge-page-key" />
      </Labelled>

      <Labelled
        label="Roles allowed to retrieve it"
        hint="Leave all unticked for everybody. Ticking any restricts it to those roles — enforced before retrieval, not by the model."
      >
        <div className="flex flex-wrap gap-1.5" data-testid="knowledge-roles">
          {roles.map((role) => {
            const on = allowedRoles.includes(role)
            return (
              <button
                key={role}
                type="button"
                onClick={() =>
                  setAllowedRoles((current) =>
                    on ? current.filter((r) => r !== role) : [...current, role],
                  )
                }
                data-testid={`knowledge-role-${role}`}
                className={clsx(
                  'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  on
                    ? 'bg-brand/12 border-sky-300/35 text-brand'
                    : 'bg-canvas border-line text-muted hover:text-ink',
                )}
              >
                {role}
              </button>
            )
          })}
        </div>
      </Labelled>

      <Labelled label="Arabic .txt file" problem={problem ?? undefined}>
        <label className="flex items-center gap-2.5 h-11 px-3.5 rounded-xl bg-canvas border border-line cursor-pointer hover:border-line transition-colors">
          <Upload size={15} className="text-muted shrink-0" />
          <span className="text-[13px] text-muted truncate flex-1">
            {file ? file.name : 'Choose a .txt file'}
          </span>
          <input
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            className="hidden"
            data-testid="knowledge-file"
            onChange={(e) => void readFile(e.target.files?.[0])}
          />
        </label>
      </Labelled>

      {file && (
        <p className="text-[11px] text-muted -mt-2 mb-4">
          {file.content.length.toLocaleString()} characters
          {videosFound > 0 && ` · ${videosFound} YouTube link(s) detected`}
        </p>
      )}

      <PlatformButton
        onClick={() =>
          file &&
          create.mutate({
            title: title.trim(),
            content: file.content,
            scope,
            tenantId: scope === 'TENANT' ? tenantId : null,
            filename: file.name,
            allowedRoles,
            module: module.trim() || 'GENERAL',
            pageKey: pageKey.trim() || null,
          })
        }
        disabled={!ready}
        busy={create.isPending}
        testId="knowledge-submit"
        className="w-full"
      >
        {create.isPending ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Upload size={15} />
        )}
        Upload and index
      </PlatformButton>
    </PlatformCard>
  )
}
