/**
 * The four questions people actually have.
 *
 * Configuration rather than markup so the panel, the training page and anything added later
 * offer the same set. The label is what the button says; the question is what is sent — they
 * differ because a button has to be short and a question to a model should not be.
 */
export interface QuickAction {
  id: string
  labelKey: string
  questionKey: string
}

export const QUICK_ACTIONS: QuickAction[] = [
  { id: 'explain-page', labelKey: 'quick.explainPage', questionKey: 'quick.explainPageQuestion' },
  { id: 'what-can-i-do', labelKey: 'quick.whatCanIDo', questionKey: 'quick.whatCanIDoQuestion' },
  { id: 'next-step', labelKey: 'quick.nextStep', questionKey: 'quick.nextStepQuestion' },
  { id: 'how-to-use', labelKey: 'quick.howToUse', questionKey: 'quick.howToUseQuestion' },
]
