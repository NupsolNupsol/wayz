import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Globe, RefreshCw, Trash2, Upload } from 'lucide-react';

import { PageHeader } from '@/components/PageHeader';
import { Badge, Button, Card, EmptyState, Field, SectionTitle, Spinner } from '@/components/ui';
import { DataTable } from '@/components/DataTable';
import { Select } from '@/components/Select';
import { platformApi, type KnowledgeDocument } from '@/api/platform.api';

/**
 * What the assistant has been given to read.
 *
 * ## Generic or specific
 *
 * A document is one of two things and the difference matters more than anything else on this
 * screen:
 *
 *  - **Generic** — the platform's own. How a workflow runs, what a status means, a policy that
 *    applies everywhere. Anybody at any company can be answered from it.
 *  - **Specific** — one company's. Their procedure, their prices, their site notes. Only that
 *    company can ever be answered from it, and the AI service filters retrieval on the way out
 *    so it cannot leak into somebody else's answer.
 *
 * The control for that is a single dropdown, because it is a single decision, and it defaults
 * to generic — the safer of the two to get wrong in the direction of, since a generic document
 * is one somebody chose to publish to everybody.
 *
 * ## The file never leaves the browser as a file
 *
 * The browser reads it and posts the text. The API forwards text to the AI service, which is
 * what that service's own documentation asks the web interface to do — nothing buffers or
 * proxies an upload stream.
 */

const READABLE = ['.txt', '.md', '.csv', '.json'] as const;

export function PlatformKnowledge() {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [text, setText] = useState('');
  const [filename, setFilename] = useState('');
  const [error, setError] = useState('');

  const documents = useQuery({
    queryKey: ['platform', 'knowledge'],
    queryFn: () => platformApi.knowledge(),
  });
  const organisations = useQuery({
    queryKey: ['platform', 'organisations'],
    queryFn: () => platformApi.organisations(),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['platform', 'knowledge'] });

  const upload = useMutation({
    mutationFn: () =>
      platformApi.uploadKnowledge({
        title,
        text,
        filename: filename || undefined,
        ...(organizationId ? { organizationId } : {}),
      }),
    onSuccess: () => {
      setTitle('');
      setText('');
      setFilename('');
      setError('');
      if (fileInput.current) fileInput.current.value = '';
      void refresh();
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : 'Could not index that document.'),
  });

  const reindex = useMutation({
    mutationFn: (id: string) => platformApi.reindexKnowledge(id),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => platformApi.removeKnowledge(id),
    onSuccess: refresh,
  });

  /** Reads the chosen file in the browser. Text formats only — this is not a document converter. */
  const readFile = async (file: File) => {
    const ok = READABLE.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!ok) {
      setError(
        `The assistant reads plain text. Convert it first, or paste the contents (${READABLE.join(', ')}).`
      );
      return;
    }
    setError('');
    setFilename(file.name);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
    setText(await file.text());
  };

  const rows = documents.data?.documents ?? [];
  const companies = organisations.data?.organisations ?? [];

  return (
    <div data-testid="platform-knowledge">
      <PageHeader title="Knowledge" subtitle="What the learning assistant has been given to read" />

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Card className="p-4" data-testid="knowledge-upload">
          <SectionTitle>Add a document</SectionTitle>

          <div className="mt-3 grid gap-3">
            <Field label="Title" required>
              <input
                className="lf-input"
                data-testid="knowledge-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Refund policy"
              />
            </Field>

            <Field
              label="Who can be answered from it"
              hint="Generic reaches every organisation. Specific reaches only the one you pick."
            >
              <Select
                testId="knowledge-scope"
                value={organizationId}
                onChange={setOrganizationId}
                options={[
                  { value: '', label: 'Generic — every organisation' },
                  ...companies.map((c) => ({ value: c.id, label: `${c.name} only` })),
                ]}
              />
            </Field>

            <Field label="File" hint={`Plain text: ${READABLE.join(', ')}`}>
              <input
                ref={fileInput}
                type="file"
                accept={READABLE.join(',')}
                data-testid="knowledge-file"
                className="lf-input py-1.5"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void readFile(file);
                }}
              />
            </Field>

            <Field
              label="Or paste the text"
              hint={text ? `${text.length.toLocaleString()} characters` : undefined}
            >
              <textarea
                className="lf-input min-h-[120px] py-2"
                data-testid="knowledge-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the contents here…"
              />
            </Field>

            {error && (
              <div
                className="rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger"
                data-testid="knowledge-error"
              >
                {error}
              </div>
            )}

            <Button
              onClick={() => upload.mutate()}
              disabled={upload.isPending || !title.trim() || !text.trim()}
              data-testid="knowledge-submit"
            >
              <Upload size={15} />
              {upload.isPending ? 'Indexing…' : 'Index this document'}
            </Button>
          </div>
        </Card>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <Badge tone="neutral" data-testid="knowledge-generic-count">
              <Globe size={12} /> {documents.data?.generic ?? 0} generic
            </Badge>
            <Badge tone="neutral" data-testid="knowledge-specific-count">
              {documents.data?.specific ?? 0} organisation-specific
            </Badge>
          </div>

          <Card className="p-0">
            {documents.isLoading ? (
              <div className="p-6">
                <Spinner />
              </div>
            ) : rows.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<BookOpen size={28} />}
                  title="Nothing indexed yet"
                  message="Add a document and the assistant can start answering from it."
                />
              </div>
            ) : (
              <DataTable<KnowledgeDocument>
                testId="knowledge-documents"
                rows={rows}
                keyOf={(d) => d.id}
                pageSize={15}
                empty={{ title: 'Nothing indexed yet.' }}
                columns={[
                  {
                    key: 'title',
                    header: 'Document',
                    sortValue: (d) => d.title,
                    render: (d) => d.title,
                  },
                  {
                    key: 'scope',
                    header: 'Reaches',
                    sortValue: (d) => (d.scope === 'GLOBAL' ? 'generic' : (d.tenantName ?? '')),
                    render: (d) =>
                      d.scope === 'GLOBAL' ? (
                        <Badge tone="neutral">
                          <Globe size={12} /> Generic
                        </Badge>
                      ) : (
                        <Badge tone="info">{d.tenantName ?? d.tenantId}</Badge>
                      ),
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    sortValue: (d) => d.status,
                    render: (d) => (
                      <span title={d.error ?? undefined}>
                        <Badge
                          tone={d.status === 'INDEXED' ? 'success' : d.error ? 'danger' : 'warning'}
                        >
                          {d.status.toLowerCase()}
                        </Badge>
                      </span>
                    ),
                  },
                  {
                    key: 'chunks',
                    header: 'Passages',
                    align: 'right',
                    sortValue: (d) => d.chunks,
                    render: (d) => d.chunks,
                  },
                  {
                    key: 'actions',
                    header: '',
                    align: 'right',
                    render: (d) => (
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          title="Index it again"
                          data-testid={`knowledge-reindex-${d.id}`}
                          onClick={() => reindex.mutate(d.id)}
                          className="rounded p-1.5 text-muted hover:bg-canvas hover:text-navy dark:hover:bg-dk-elevated"
                        >
                          <RefreshCw size={14} />
                        </button>
                        <button
                          type="button"
                          title="Remove it"
                          data-testid={`knowledge-remove-${d.id}`}
                          onClick={() => remove.mutate(d.id)}
                          className="rounded p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ),
                  },
                ]}
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
