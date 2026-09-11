import { Schema } from 'mongoose'
import { randomBytes } from 'node:crypto'

export interface InvoiceDocDoc {
  _id: string
  tenantId: string
  bookingId: string
  orderRef: string
  pdf: Buffer
  expiresAt: Date
  createdAt: Date
}

const invoiceDocSchema = new Schema<InvoiceDocDoc>(
  {
    _id: { type: String, default: () => randomBytes(24).toString('base64url') },
    tenantId: { type: String, required: true, index: true },
    bookingId: { type: String, required: true, index: true },
    orderRef: { type: String, required: true },
    pdf: { type: Buffer, required: true },
    expiresAt: { type: Date, required: true },
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } },
)

invoiceDocSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

/**
 * An invoice PDF is opened from a link, by somebody with no account.
 *
 * The document's own id is the token in that link, so it is registered the same way a
 * booking's tracking token is — otherwise the link resolves to no tenant and the customer
 * is told their invoice expired when it did not.
 */
invoiceDocSchema.post('save', function (doc) {
  const token = (doc as { _id?: string })?._id
  if (!token) return
  void (async () => {
    try {
      const [{ currentTenant }, { registerPublicToken }] = await Promise.all([
        import('../platform/tenantContext.js'),
        import('../platform/publicLinks.js'),
      ])
      const tenant = currentTenant()
      if (tenant) await registerPublicToken(token, tenant.tenantId)
    } catch {
      /* never at the cost of the invoice itself */
    }
  })()
})

export const InvoiceDocSchema = invoiceDocSchema
