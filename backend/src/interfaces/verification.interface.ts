import type { IdDocumentType, VerificationPurpose } from '../domain/types.js'

export interface DocumentInput {
  documentType: IdDocumentType
  documentNumber: string
  holderName: string
  image?: string
}

export type ConfirmVerificationInput =
  | { purpose: VerificationPurpose; method: 'WHATSAPP_OTP'; code: string }
  | { purpose: VerificationPurpose; method: 'EMAIL_OTP'; code: string }
  | { purpose: VerificationPurpose; method: 'ID_DOCUMENT'; reason: string; document: DocumentInput }
  | {
      purpose: VerificationPurpose
      method: 'MANAGER_OVERRIDE'
      reason: string
      authoriserEmail: string
      authoriserPassword: string
      document?: DocumentInput
    }
