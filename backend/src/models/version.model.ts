import mongoose, { Schema } from 'mongoose'

export interface VersionLink {
  label: string
  to: string
}

export interface VersionCheck {
  by: string
  at: Date
}

export interface VersionIssue {
  by: string
  note: string
  at: Date
  status: 'OPEN' | 'RESOLVED'
}

export interface VersionChange {
  area: string
  title: string
  detail: string
  roles: string[]
  howToTest: string[]
  expect: string
  links: VersionLink[]
  checks: VersionCheck[]
  issues: VersionIssue[]
}

export interface VersionDoc {
  _id: string
  number: string
  name: string
  status: 'DRAFT' | 'RELEASED'
  releasedAt: Date
  summary: string
  highlights: string[]
  changes: VersionChange[]
  createdAt: Date
  updatedAt: Date
}

const changeSchema = new Schema<VersionChange>(
  {
    area: { type: String, required: true },
    title: { type: String, required: true },
    detail: { type: String, default: '' },
    roles: { type: [String], default: [] },
    howToTest: { type: [String], default: [] },
    expect: { type: String, default: '' },
    links: {
      type: [new Schema<VersionLink>({ label: { type: String, required: true }, to: { type: String, required: true } }, { _id: false })],
      default: [],
    },
    checks: {
      type: [new Schema<VersionCheck>({ by: { type: String, required: true }, at: { type: Date, default: Date.now } }, { _id: false })],
      default: [],
    },
    issues: {
      type: [
        new Schema<VersionIssue>(
          {
            by: { type: String, required: true },
            note: { type: String, required: true },
            at: { type: Date, default: Date.now },
            status: { type: String, default: 'OPEN' },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { _id: false },
)

const versionSchema = new Schema<VersionDoc>(
  {
    _id: { type: String, required: true },
    number: { type: String, required: true },
    name: { type: String, required: true },
    status: { type: String, default: 'RELEASED', index: true },
    releasedAt: { type: Date, default: Date.now, index: true },
    summary: { type: String, default: '' },
    highlights: { type: [String], default: [] },
    changes: { type: [changeSchema], default: [] },
  },
  { _id: false, timestamps: true },
)

export const Version = mongoose.model<VersionDoc>('Version', versionSchema)
