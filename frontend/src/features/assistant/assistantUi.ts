import { createContext, useContext } from 'react';
import type { PageContextValue } from './pageContext';

/**
 * The assistant's shared state, kept apart from the component that provides it.
 *
 * Two reasons, and the second is the real one: a module that exports both a component and a
 * hook breaks React Fast Refresh, and a context is the sort of thing several unrelated
 * screens reach for — the training page opens the panel, pages register themselves, the
 * launcher toggles it. None of them should have to import the provider to do it.
 */
export interface AssistantUi {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Opens the panel and immediately asks — used by the "explain this page" shortcuts. */
  openWith: (question: string) => void;
  pendingQuestion: string | null;
  clearPending: () => void;
  pageContext: () => PageContextValue | null;
  /** Changes when a different page registers, so consumers can recompute their labels. */
  pageVersion: number;
  route: string;
}

export const AssistantUiContext = createContext<AssistantUi | null>(null);

export function useAssistantUi(): AssistantUi {
  const value = useContext(AssistantUiContext);
  if (!value) throw new Error('useAssistantUi must be used inside <AssistantProvider>');
  return value;
}
