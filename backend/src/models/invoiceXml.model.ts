import { Schema } from 'mongoose'
import { nanoid } from 'nanoid'

export interface InvoiceXmlDoc {
  _id: string
  tenantId: string
  bookingId: string
  orderId: string
  invoiceNumber: string
  uuid: string
  invoiceCounter: number
  previousInvoiceHash: string
  invoiceHash: string
  filePath: string
  createdAt: Date
  updatedAt: Date
}

const invoiceXmlSchema = new Schema<InvoiceXmlDoc>(
  {
    _id: { type: String, default: () => `xml_${nanoid(10)}` },
    tenantId: { type: String, required: true, index: true },
    bookingId: { type: String, required: true, index: true },
    orderId: { type: String, required: true, index: true },
    invoiceNumber: { type: String, required: true },
    uuid: { type: String, required: true },
    invoiceCounter: { type: Number, required: true },
    previousInvoiceHash: { type: String, required: true },
    invoiceHash: { type: String, required: true },
    filePath: { type: String, required: true },
  },
  { _id: false, timestamps: true },
)

invoiceXmlSchema.index({ tenantId: 1, invoiceCounter: -1 })
invoiceXmlSchema.index({ tenantId: 1, createdAt: -1 })

export const InvoiceXmlSchema = invoiceXmlSchema
