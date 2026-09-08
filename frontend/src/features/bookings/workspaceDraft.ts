/**
 * A half-finished sale, kept in the tab so an agent who is called away — or who taps the wrong
 * menu item — comes back to the counter exactly as they left it. It lives in sessionStorage: it
 * belongs to this tab and this shift, not to the machine.
 */
export interface WorkspaceDraft {
  step: number
  customerId: string | null
  bookingId: string | null
  /** Whatever else that counter needs to rebuild itself. */
  extra?: Record<string, unknown>
}

const draftKey = (workspace: string) => `wayz.workspace.${workspace}`

export function readDraft<T extends WorkspaceDraft = WorkspaceDraft>(workspace: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(draftKey(workspace))
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeDraft(workspace: string, draft: WorkspaceDraft | null) {
  try {
    if (!draft) window.sessionStorage.removeItem(draftKey(workspace))
    else window.sessionStorage.setItem(draftKey(workspace), JSON.stringify(draft))
  } catch {
    /* a private window just loses the resume, nothing else */
  }
}
