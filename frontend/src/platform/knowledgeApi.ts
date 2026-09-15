import { platformHttp, unwrapPlatform } from './platformClient'

/**
 * Knowledge management, from the control plane's own session.
 *
 * Uses `platformHttp` rather than the tenant client: these calls carry the super admin's
 * credential, and a tenant token must never be able to reach them. The server enforces the
 * same separation with a token audience; this is the client half of that fence.
 */

export type KnowledgeScope = 'GLOBAL' | 'TENANT'
export type IndexStatus = 'PENDING' | 'INDEXING' | 'INDEXED' | 'FAILED'

export interface KnowledgeDocument {
  id: string
  title: string
  filename: string
  scope: KnowledgeScope
  tenant_id: string | null
  tenant_name: string | null
  allowed_roles: string[]
  module: string
  page_key: string | null
  language: string
  version: number
  status: IndexStatus
  error: string | null
  chunk_count: number
  char_count: number
  video_urls: string[]
  uploaded_by: string
  created_at: string
  updated_at: string
  indexed_at: string | null
}

export interface KnowledgeDocumentDetail extends KnowledgeDocument {
  content: string
  notes: string
  chunk_ids: string[]
}

export interface KnowledgeVocabulary {
  enabled: boolean
  roles: string[]
  tenants: { id: string; slug: string; name: string; lifecycle: string }[]
}

export interface LearningAnalytics {
  totals: {
    questions: number
    grounded: number
    ungrounded: number
    speech_requests: number
    helpful: number
    not_helpful: number
    video_clicks: number
  }
  top_questions: { question: string; count: number }[]
  top_pages: { page_key: string; count: number }[]
  by_role: { role: string; count: number }[]
  by_tenant: { tenant: string; count: number }[]
  top_documents: { document_id: string; title: string; uses: number }[]
  top_videos: { url: string; title: string; clicks: number }[]
  unanswered: {
    question: string
    page_key: string | null
    tenant_name: string | null
    role: string | null
    at: string
  }[]
}

export interface CreateDocumentInput {
  title: string
  content: string
  scope: KnowledgeScope
  tenantId?: string | null
  filename: string
  allowedRoles: string[]
  module: string
  pageKey?: string | null
  notes?: string
}

export const knowledgeApi = {
  vocabulary: () => unwrapPlatform<KnowledgeVocabulary>(platformHttp.get('/knowledge/vocabulary')),

  list: (params: { scope: KnowledgeScope; tenantId?: string | null }) => {
    const query = new URLSearchParams({ scope: params.scope })
    if (params.scope === 'TENANT' && params.tenantId) query.set('tenantId', params.tenantId)
    return unwrapPlatform<{ items: KnowledgeDocument[]; total: number }>(
      platformHttp.get(`/knowledge/documents?${query.toString()}`),
    )
  },

  detail: (id: string) =>
    unwrapPlatform<KnowledgeDocumentDetail>(platformHttp.get(`/knowledge/documents/${id}`)),

  create: (body: CreateDocumentInput) =>
    unwrapPlatform<KnowledgeDocument>(platformHttp.post('/knowledge/documents', body)),

  reindex: (id: string) =>
    unwrapPlatform<{ id: string; status: IndexStatus; chunk_count: number; error: string | null }>(
      platformHttp.post(`/knowledge/documents/${id}/reindex`),
    ),

  remove: (id: string) =>
    unwrapPlatform<{ deleted: boolean }>(platformHttp.delete(`/knowledge/documents/${id}`)),

  analytics: (params: { days: number; tenantId?: string | null }) => {
    const query = new URLSearchParams({ days: String(params.days) })
    if (params.tenantId) query.set('tenantId', params.tenantId)
    return unwrapPlatform<LearningAnalytics>(
      platformHttp.get(`/knowledge/analytics?${query.toString()}`),
    )
  },

  health: () =>
    unwrapPlatform<{ reachable: boolean; status: string; checks?: Record<string, unknown> }>(
      platformHttp.get('/knowledge/health'),
    ),
}
