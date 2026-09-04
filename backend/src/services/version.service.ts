import { Version } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { nextId } from './counter.service.js'
import type { VersionChange } from '../models/index.js'

type ChangeInput = Omit<VersionChange, 'checks' | 'issues'> & { checks?: VersionChange['checks']; issues?: VersionChange['issues'] }

export interface VersionInput {
  number: string
  name: string
  summary?: string
  status?: 'DRAFT' | 'RELEASED'
  releasedAt?: string
  highlights?: string[]
  changes?: ChangeInput[]
}

export async function listVersions() {
  const rows = await Version.find({ status: 'RELEASED' }).sort({ releasedAt: -1 }).lean()
  return rows.map((v) => ({
    _id: v._id,
    number: v.number,
    name: v.name,
    releasedAt: v.releasedAt,
    summary: v.summary,
    highlights: v.highlights ?? [],
    changeCount: (v.changes ?? []).length,
    checkedCount: (v.changes ?? []).filter((c) => (c.checks ?? []).length > 0).length,
    openIssues: (v.changes ?? []).reduce((sum, c) => sum + (c.issues ?? []).filter((i) => i.status === 'OPEN').length, 0),
    areas: [...new Set((v.changes ?? []).map((c) => c.area))],
  }))
}

export async function readVersion(id: string) {
  const doc = await Version.findOne({ _id: id, status: 'RELEASED' }).lean()
  if (!doc) throw ApiError.notFound('That version does not exist.')
  return doc
}

const trimmed = (value: string, max: number) => value.trim().slice(0, max)

export async function checkOffChange(id: string, index: number, by: string) {
  const version = await Version.findOne({ _id: id })
  if (!version) throw ApiError.notFound('That version does not exist.')

  const change = version.changes[index]
  if (!change) throw ApiError.notFound('That change is not on this release.')

  const name = trimmed(by, 60)
  if (!name) throw ApiError.badRequest('Say who checked it.')

  const already = change.checks.some((c) => c.by.toLowerCase() === name.toLowerCase())
  if (!already) change.checks.push({ by: name, at: new Date() })

  version.markModified('changes')
  await version.save()
  return version.toObject()
}

export async function reportIssue(id: string, index: number, by: string, note: string) {
  const version = await Version.findOne({ _id: id })
  if (!version) throw ApiError.notFound('That version does not exist.')

  const change = version.changes[index]
  if (!change) throw ApiError.notFound('That change is not on this release.')

  const name = trimmed(by, 60)
  const said = trimmed(note, 1000)
  if (!name) throw ApiError.badRequest('Say who is reporting it.')
  if (said.length < 3) throw ApiError.badRequest('Say what went wrong.')

  change.issues.push({ by: name, note: said, at: new Date(), status: 'OPEN' })
  version.markModified('changes')
  await version.save()
  return version.toObject()
}

export async function writeVersion(input: VersionInput, id?: string) {
  const patch = {
    number: input.number.trim(),
    name: input.name.trim(),
    summary: input.summary ?? '',
    status: input.status ?? 'RELEASED',
    releasedAt: input.releasedAt ? new Date(input.releasedAt) : new Date(),
    highlights: input.highlights ?? [],
    changes: (input.changes ?? []).map((c) => ({ ...c, checks: c.checks ?? [], issues: c.issues ?? [] })),
  }

  if (id) {
    const existing = await Version.findOneAndUpdate({ _id: id }, { $set: patch }, { new: true }).lean()
    if (!existing) throw ApiError.notFound('That version does not exist.')
    return existing
  }

  return (await Version.create({ _id: await nextId('version'), ...patch })).toObject()
}

export async function removeVersion(id: string) {
  const gone = await Version.deleteOne({ _id: id })
  if (gone.deletedCount === 0) throw ApiError.notFound('That version does not exist.')
  return { removed: id }
}
