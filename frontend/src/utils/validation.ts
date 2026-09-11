
const MIN_LOCAL_DIGITS = 7
const MAX_LOCAL_DIGITS = 15

export interface FieldProblem {
  field: 'name' | 'phone' | 'email' | 'nationalId'
  messageKey: string
}

export function localDigits(phone: string): string {
  const trimmed = (phone ?? '').trim()
  const withoutDial = trimmed.startsWith('+') ? trimmed.replace(/^\+\d{1,4}\s*/, '') : trimmed
  return withoutDial.replace(/\D/g, '')
}

export function isCompleteName(name: string): boolean {
  return (name ?? '').trim().length >= 2
}

export function isCompletePhone(phone: string): boolean {
  const digits = localDigits(phone)
  return digits.length >= MIN_LOCAL_DIGITS && digits.length <= MAX_LOCAL_DIGITS
}

export function isCompleteEmail(email: string): boolean {
  const value = (email ?? '').trim()
  if (!value) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
}

export function customerProblems(input: { name: string; phone: string; email?: string }): FieldProblem[] {
  const problems: FieldProblem[] = []
  if (!isCompleteName(input.name)) problems.push({ field: 'name', messageKey: 'ui:customer.nameTooShort' })
  if (!isCompletePhone(input.phone)) problems.push({ field: 'phone', messageKey: 'ui:customer.phoneIncomplete' })
  if (!isCompleteEmail(input.email ?? '')) problems.push({ field: 'email', messageKey: 'ui:customer.emailInvalid' })
  return problems
}

export const isCustomerComplete = (input: { name: string; phone: string; email?: string }): boolean =>
  customerProblems(input).length === 0

/**
 * An id number long enough to be one. Nothing stricter: the desks see national ids, residency
 * permits and passports, and every one of those is shaped differently.
 */
export function isCompleteNationalId(value: string): boolean {
  return (value ?? '').trim().length >= 4
}

/**
 * What registering a new customer asks for, as opposed to what an existing one needs in order to
 * be sold to. The card number is required of somebody being put on the books for the first time;
 * demanding it of the thousands already there would stop sales at the counter to ask for a number
 * nobody recorded when they signed up.
 */
export function registrationProblems(input: {
  name: string
  phone: string
  email?: string
  nationalId: string
}): FieldProblem[] {
  const problems = customerProblems(input)
  if (!isCompleteNationalId(input.nationalId)) {
    problems.push({ field: 'nationalId', messageKey: 'ui:customer.nationalIdRequired' })
  }
  return problems
}
