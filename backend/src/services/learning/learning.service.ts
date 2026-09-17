import { LearningProgress, Tenant, User } from '../../models/index.js';
import { requireOrganisation } from '../../platform/orgScope.js';
import { ApiError } from '../../utils/ApiError.js';
import type { Role } from '../../domain/types.js';
import { aiClient, type EmployeeActor } from './aiClient.js';

/**
 * The employee half of the learning system.
 *
 * Everything here reads the caller's identity from the verified session and the current
 * tenant context. Nothing accepts a tenant, a role or a user id from a request body — that
 * is the point of the whole design, and the place it would be easiest to quietly undo.
 */

/** Which guided tour a role gets. The steps themselves are configuration in the browser. */
const TOUR_BY_ROLE: Record<Role, string> = {
  AGENT: 'agent',
  CHIEF_CAPTAIN: 'captain',
  DELIVERY_AGENT: 'courier',
  SUPERVISOR: 'manager',
  MANAGER: 'manager',
  PROJECT_MANAGER: 'manager',
  HR: 'hr',
  ACCOUNTANT: 'accountant',
  TENANT_ADMIN: 'admin',
};

export const tourKeyFor = (role: Role): string => TOUR_BY_ROLE[role] ?? 'agent';

export interface SessionIdentity {
  sub: string;
  role: Role;
}

/**
 * The signed actor sent to the AI service, assembled from trusted sources only.
 *
 * The organisation comes from `requireOrganisation()` — established from the session token by
 * the authenticate middleware — and the role and user id come from the verified token. The
 * user is looked up to confirm they still exist and are still active, because a session that
 * outlives a dismissal should not keep answering questions as that person.
 */
export async function actorFor(identity: SessionIdentity): Promise<EmployeeActor> {
  const organizationId = requireOrganisation();

  const user = await User.findById(identity.sub)
    .select({ fullName: 1, role: 1, active: 1 })
    .lean<{ _id: string; fullName: string; role: Role; active: boolean } | null>();
  if (!user?.active) throw ApiError.unauthorized('That account is no longer active.');

  /*
   * By id: the organisation document carries no `tenantId` and so is exempt from automatic
   * scoping. An unqualified `findOne()` returns whichever organisation is first in the
   * collection, which would tell a WIQAR employee they work for WAYZ.
   */
  const tenant = await Tenant.findById(organizationId)
    .select({ name: 1 })
    .lean<{ name?: string } | null>();

  return {
    kind: 'EMPLOYEE',
    userId: user._id,
    tenantId: organizationId,
    tenantSlug: organizationId,
    tenantName: tenant?.name || organizationId,
    // The role on the record, not the one in the token: a demotion takes effect on the next
    // request rather than at the end of a twelve-hour session.
    role: user.role,
    locale: 'ar',
    displayName: user.fullName,
  };
}

// ------------------------------------------------------------------ the assistant

export interface PageContextInput {
  pageKey?: string;
  route?: string;
  module?: string;
  screenTitle?: string;
  entityType?: string;
  entityStatus?: string;
  availableActions?: string[];
  facts?: Record<string, string>;
}

export interface ChatInput {
  question: string;
  page?: PageContextInput;
  history?: { role: 'user' | 'assistant'; content: string }[];
  conversationId?: string;
}

const toSnakePage = (page?: PageContextInput) =>
  page
    ? {
        page_key: page.pageKey ?? null,
        route: page.route ?? null,
        module: page.module ?? null,
        screen_title: page.screenTitle ?? null,
        entity_type: page.entityType ?? null,
        entity_status: page.entityStatus ?? null,
        available_actions: page.availableActions ?? [],
        facts: page.facts ?? {},
      }
    : undefined;

export interface AssistantAnswer {
  answer: string;
  sources: {
    document_id: string;
    title: string;
    scope: 'GLOBAL' | 'TENANT';
    module: string;
    relevant_excerpt: string;
    score: number;
    tenant_name: string | null;
  }[];
  videos: { title: string; url: string; document_id: string }[];
  grounded: boolean;
  interaction_id: string;
  page_key: string | null;
  retrieved_count: number;
  model: string | null;
}

export async function ask(identity: SessionIdentity, input: ChatInput): Promise<AssistantAnswer> {
  const actor = await actorFor(identity);
  return aiClient.post<AssistantAnswer>(actor, '/v1/chat', {
    question: input.question,
    page: toSnakePage(input.page),
    history: input.history ?? [],
    conversation_id: input.conversationId ?? null,
  });
}

export async function speak(
  identity: SessionIdentity,
  text: string,
  interactionId?: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const actor = await actorFor(identity);
  return aiClient.binary(actor, '/v1/speech', {
    text,
    language: 'ar',
    interaction_id: interactionId ?? null,
  });
}

export async function recordFeedback(
  identity: SessionIdentity,
  input: { interactionId: string; helpful: boolean; comment?: string }
): Promise<void> {
  const actor = await actorFor(identity);
  await aiClient.post(actor, '/v1/feedback', {
    interaction_id: input.interactionId,
    helpful: input.helpful,
    comment: input.comment ?? '',
  });
}

export async function recordVideoClick(
  identity: SessionIdentity,
  input: { url: string; title?: string; interactionId?: string; documentId?: string }
): Promise<void> {
  const actor = await actorFor(identity);
  await aiClient.post(actor, '/v1/events/video-click', {
    url: input.url,
    title: input.title ?? '',
    interaction_id: input.interactionId ?? null,
    document_id: input.documentId ?? null,
  });
}

// ------------------------------------------------------------------ onboarding

export interface OnboardingState {
  tourKey: string;
  role: Role;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  stepIndex: number;
  completedSteps: string[];
  restarts: number;
  /** Whether the tour should start on its own right now. */
  shouldAutoStart: boolean;
}

function present(
  doc: {
    tourKey: string;
    role: string;
    status: OnboardingState['status'];
    stepIndex: number;
    completedSteps: string[];
    restarts: number;
  } | null,
  role: Role
): OnboardingState {
  const tourKey = tourKeyFor(role);

  // A tour recorded against a different role does not count: somebody promoted to supervisor
  // has not been shown the supervisor's workflow, whatever they finished as an agent.
  const applies = doc?.tourKey === tourKey;
  const status = applies ? doc!.status : 'PENDING';

  return {
    tourKey,
    role,
    status,
    stepIndex: applies ? doc!.stepIndex : 0,
    completedSteps: applies ? doc!.completedSteps : [],
    restarts: applies ? doc!.restarts : 0,
    /*
     * Only PENDING — never IN_PROGRESS.
     *
     * The tour is a full-screen overlay. Resuming it automatically meant somebody who walked
     * away from it half way had it thrown back over the top of every page they opened
     * afterwards, with the application unusable underneath until they dismissed it again.
     * Somebody who started and left has seen it; if they want the rest, the training page
     * offers it. Being helpful once is a feature, being unavoidable is not.
     */
    shouldAutoStart: status === 'PENDING',
  };
}

export async function onboardingState(identity: SessionIdentity): Promise<OnboardingState> {
  const doc = await LearningProgress.findById(identity.sub).lean<{
    tourKey: string;
    role: string;
    status: OnboardingState['status'];
    stepIndex: number;
    completedSteps: string[];
    restarts: number;
  } | null>();
  return present(doc, identity.role);
}

export async function saveOnboarding(
  identity: SessionIdentity,
  input: {
    status: 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
    stepIndex?: number;
    completedStep?: string;
    restart?: boolean;
  }
): Promise<OnboardingState> {
  const tourKey = tourKeyFor(identity.role);
  const now = new Date();

  const set: Record<string, unknown> = {
    tourKey,
    role: identity.role,
    status: input.status,
    updatedAt: now,
  };
  if (typeof input.stepIndex === 'number')
    set.stepIndex = Math.max(0, Math.min(input.stepIndex, 99));
  if (input.status === 'IN_PROGRESS') set.startedAt = now;
  if (input.status === 'COMPLETED') set.completedAt = now;

  const update: Record<string, unknown> = { $set: set, $setOnInsert: { _id: identity.sub } };
  if (input.completedStep) update.$addToSet = { completedSteps: input.completedStep };
  if (input.restart) {
    update.$inc = { restarts: 1 };
    set.stepIndex = 0;
    set.completedAt = null;
  }

  await LearningProgress.updateOne({ _id: identity.sub }, update, { upsert: true });
  return onboardingState(identity);
}
