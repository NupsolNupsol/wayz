import { http, unwrap } from './client';
import type { EngineKind } from './types';

/**
 * The platform console's API.
 *
 * Everything here runs on a platform session, which belongs to no organisation — so unlike
 * every other client in this folder, none of these calls are about "my company". They are
 * about the companies.
 */

export interface PlatformIdentity {
  id: string;
  email: string;
  name: string;
}

export interface CatalogueActivity {
  key: EngineKind;
  label: { en: string; ar: string };
  description: string;
  assetKind: string;
  sessionKind: string;
  actors: string[];
}

export interface PlatformOrganisation {
  id: string;
  name: string;
  branding: Record<string, string>;
  activities: EngineKind[];
  createdAt: string | null;
  staff: number;
  sites: number;
}

export interface OrganisationFigures {
  id: string;
  name: string;
  staff: number;
  sites: number;
  stations: number;
  resources: number;
  activities: EngineKind[];
  bookings: number;
  revenue: number;
  byActivity: { kind: EngineKind; bookings: number; revenue: number }[];
}

export interface PlatformReport {
  from: string;
  to: string;
  totals: {
    organisations: number;
    staff: number;
    sites: number;
    bookings: number;
    revenue: number;
  };
  organisations: OrganisationFigures[];
  adoption: {
    kind: EngineKind;
    label: { en: string; ar: string };
    organisations: number;
    bookings: number;
    revenue: number;
  }[];
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  /** GLOBAL is the generic document every organisation can draw on; TENANT belongs to one. */
  scope: 'GLOBAL' | 'TENANT';
  tenantId: string | null;
  tenantName: string | null;
  status: string;
  chunks: number;
  error: string | null;
  createdAt: string;
}

export interface CreateOrganisationInput {
  id: string;
  name: string;
  activities: EngineKind[];
  branding?: Record<string, string>;
  admin: { fullName: string; email: string; password: string };
}

export const platformApi = {
  me: () => unwrap<PlatformIdentity>(http.get('/platform/me')),

  catalogue: () => unwrap<{ activities: CatalogueActivity[] }>(http.get('/platform/catalogue')),

  assistant: () => unwrap<{ reachable: boolean; status: string }>(http.get('/platform/assistant')),

  organisations: () =>
    unwrap<{ organisations: PlatformOrganisation[] }>(http.get('/platform/organisations')),

  createOrganisation: (body: CreateOrganisationInput) =>
    unwrap<PlatformOrganisation>(http.post('/platform/organisations', body)),

  updateOrganisation: (
    id: string,
    body: { name?: string; activities?: EngineKind[]; branding?: Record<string, string> }
  ) => unwrap<PlatformOrganisation>(http.patch(`/platform/organisations/${id}`, body)),

  report: (params?: { from?: string; to?: string }) =>
    unwrap<PlatformReport>(http.get('/platform/report', { params })),

  knowledge: (organizationId?: string) =>
    unwrap<{ documents: KnowledgeDocument[]; generic: number; specific: number }>(
      http.get('/platform/knowledge', { params: organizationId ? { organizationId } : undefined })
    ),

  /**
   * Adds a document for the assistant to read.
   *
   * `organizationId` absent means generic — retrievable by everybody. Present means it belongs
   * to that organisation and nobody else can ever be answered from it.
   */
  uploadKnowledge: (body: {
    title: string;
    text: string;
    organizationId?: string;
    filename?: string;
    language?: string;
    tags?: string[];
  }) => unwrap<KnowledgeDocument>(http.post('/platform/knowledge', body)),

  reindexKnowledge: (id: string) => unwrap<unknown>(http.post(`/platform/knowledge/${id}/reindex`)),

  removeKnowledge: (id: string) =>
    unwrap<{ removed: string }>(http.delete(`/platform/knowledge/${id}`)),
};
