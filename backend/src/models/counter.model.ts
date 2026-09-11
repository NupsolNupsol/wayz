import { Schema } from 'mongoose'

export interface CounterDoc {
  _id: string
  seq: number
}

const counterSchema = new Schema<CounterDoc>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { _id: false, versionKey: false },
)

export const CounterSchema = counterSchema
