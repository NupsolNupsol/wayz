import { http, unwrap } from './client';
import type { Role } from './types';

/**
 * The employee assistant, as the browser sees it.
 *
 * Note what is *not* here: no tenant, no role, no user id. The browser never sends them,
 * because the API reads them from the session it already verified and signs them into the
 * token it hands the AI service. A field for them on this side would be a field an employee
 * of another company could also fill in.
 */

export type KnowledgeScope = 'GLOBAL' | 'TENANT';

/** What a screen is willing to tell the assistant about itself. See `features/assistant`. */
export interface PageContextPayload {
  pageKey?: string;
  route?: string;
  module?: string;
  screenTitle?: string;
  entityType?: string;
  entityStatus?: string;
  availableActions?: string[];
  facts?: Record<string, string>;
}

export interface AssistantSource {
  document_id: string;
  title: string;
  scope: KnowledgeScope;
  module: string;
  relevant_excerpt: string;
  score: number;
  tenant_name: string | null;
}

export interface AssistantVideo {
  title: string;
  url: string;
  document_id: string;
}

export interface AssistantAnswer {
  answer: string;
  sources: AssistantSource[];
  videos: AssistantVideo[];
  grounded: boolean;
  interaction_id: string;
  page_key: string | null;
  retrieved_count: number;
  model: string | null;
}

export interface OnboardingState {
  tourKey: string;
  role: Role;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  stepIndex: number;
  completedSteps: string[];
  restarts: number;
  shouldAutoStart: boolean;
}

export const learningApi = {
  capability: () => unwrap<{ enabled: boolean; tourKey: string }>(http.get('/learning/capability')),

  ask: (body: {
    question: string;
    page?: PageContextPayload;
    history?: { role: 'user' | 'assistant'; content: string }[];
  }) => unwrap<AssistantAnswer>(http.post('/learning/chat', body)),

  /**
   * The answer read aloud.
   *
   * Returns a blob rather than a URL: the audio is one employee's answer, generated on
   * demand, and giving it an address would mean giving it a lifetime and a permission model
   * of its own. The caller revokes the object URL when the player is done with it.
   */
  speak: async (text: string, interactionId?: string): Promise<Blob> => {
    const response = await http.post(
      '/learning/speech',
      { text, interactionId },
      { responseType: 'blob', timeout: 90_000 }
    );
    return response.data as Blob;
  },

  feedback: (body: { interactionId: string; helpful: boolean; comment?: string }) =>
    unwrap<{ recorded: boolean }>(http.post('/learning/feedback', body)),

  videoClick: (body: {
    url: string;
    title?: string;
    interactionId?: string;
    documentId?: string;
  }) => unwrap<{ recorded: boolean }>(http.post('/learning/events/video-click', body)),

  onboarding: () => unwrap<OnboardingState>(http.get('/learning/onboarding')),

  saveOnboarding: (body: {
    status: 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
    stepIndex?: number;
    completedStep?: string;
    restart?: boolean;
  }) => unwrap<OnboardingState>(http.post('/learning/onboarding', body)),
};
