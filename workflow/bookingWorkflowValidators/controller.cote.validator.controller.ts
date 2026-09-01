import type { ValidationResult, WorkflowContext } from '../shared/types.js'

export const useCoteValidator = (transitionCode: string, _ctx: WorkflowContext): ValidationResult => {
  const errors: string[] = []

  switch (transitionCode) {
    case 'TO_CONFIRMED': {
      break
    }

    case 'TO_SERVED': {
      break
    }

    case 'TO_CANCELLED': {
      break
    }

    default: {
      errors.push(`Unknown transition code: ${transitionCode}`)
      break
    }
  }

  return { errors }
}
