import { z } from 'zod'
import { asyncHandler } from '../utils/asyncHandler.js'
import { checkOffChange, listVersions, readVersion, removeVersion, reportIssue, writeVersion } from '../services/version.service.js'

const changeSchema = z.object({
  area: z.string().min(1),
  title: z.string().min(1),
  detail: z.string().default(''),
  roles: z.array(z.string()).default([]),
  howToTest: z.array(z.string()).default([]),
  expect: z.string().default(''),
  links: z.array(z.object({ label: z.string().min(1), to: z.string().min(1) })).default([]),
})

const versionSchema = z.object({
  number: z.string().min(1),
  name: z.string().min(1),
  summary: z.string().optional(),
  status: z.enum(['DRAFT', 'RELEASED']).optional(),
  releasedAt: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  changes: z.array(changeSchema).optional(),
})

export const versionController = {
  list: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await listVersions() })
  }),

  detail: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await readVersion(req.params.id) })
  }),

  check: asyncHandler(async (req, res) => {
    const body = z.object({ by: z.string().min(1).max(60) }).parse(req.body)
    const index = Number(req.params.index)
    res.json({ success: true, data: await checkOffChange(req.params.id, index, body.by) })
  }),

  report: asyncHandler(async (req, res) => {
    const body = z.object({ by: z.string().min(1).max(60), note: z.string().min(3).max(1000) }).parse(req.body)
    const index = Number(req.params.index)
    res.json({ success: true, data: await reportIssue(req.params.id, index, body.by, body.note) })
  }),

  create: asyncHandler(async (req, res) => {
    const body = versionSchema.parse(req.body)
    res.status(201).json({ success: true, data: await writeVersion(body) })
  }),

  update: asyncHandler(async (req, res) => {
    const body = versionSchema.parse(req.body)
    res.json({ success: true, data: await writeVersion(body, req.params.id) })
  }),

  remove: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await removeVersion(req.params.id) })
  }),
}
