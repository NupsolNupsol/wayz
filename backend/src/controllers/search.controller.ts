import { z } from 'zod'
import { asyncHandler } from '../utils/asyncHandler.js'
import { scopeFromReq } from '../utils/scope.js'
import { search } from '../services/search.service.js'

const querySchema = z.object({ q: z.string().max(120).optional() })

export const searchController = {
  search: asyncHandler(async (req, res) => {
    const { q } = querySchema.parse(req.query)
    res.json({ success: true, data: await search(scopeFromReq(req), q ?? '') })
  }),
}
