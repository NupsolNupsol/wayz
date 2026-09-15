import { z } from 'zod'

import { asyncHandler } from '../utils/asyncHandler.js'
import { requireTenant } from '../platform/tenantContext.js'
import { PERMISSIONS, PERMISSION_GROUPS, PERMISSION_KEYS } from '../platform/permissions.js'
import { ROLES } from '../domain/types.js'
import {
  assignableForRole,
  createRoleDefinition,
  listRoleDefinitions,
  removeRoleDefinition,
  updateRoleDefinition,
} from '../services/roleDefinition.service.js'

/**
 * Jobs, as the tenant that will fill them defines them.
 *
 * The tenant comes from the request context throughout — there is no route here that accepts
 * one, so no client can define a job inside another company.
 */

const tenantOf = (): string => requireTenant().tenantId

const scopeSchema = z.object({
  sites: z.enum(['ALL', 'ASSIGNED']).optional(),
  areas: z.enum(['ALL', 'ASSIGNED']).optional(),
  terminals: z.enum(['ALL', 'ASSIGNED']).optional(),
  activities: z.enum(['ALL', 'ASSIGNED']).optional(),
  resources: z.enum(['ALL', 'ASSIGNED', 'BY_ACTIVITY', 'NONE']).optional(),
})

const bodySchema = z.object({
  key: z.string().trim().min(2).max(40),
  label: z.string().trim().min(2).max(80),
  labelAr: z.string().trim().max(80).optional(),
  description: z.string().trim().max(400).optional(),
  baseRole: z.enum(ROLES),
  permissions: z.array(z.string().trim().max(60)).max(120),
  scope: scopeSchema.optional(),
  activityAccess: z.array(z.string().trim().max(40)).max(80).optional(),
  engineAccess: z.array(z.string().trim().max(40)).max(20).optional(),
  order: z.number().min(0).max(999).optional(),
})

const patchSchema = bodySchema.partial().omit({ key: true }).extend({ active: z.boolean().optional() })

export const roleDefinitionController = {
  list: asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await listRoleDefinitions(tenantOf()) })
  }),

  /**
   * The vocabulary a tenant composes jobs from.
   *
   * Sent as data rather than compiled into the editor, so a permission added to the platform
   * appears in every tenant's role editor without a frontend release.
   */
  vocabulary: asyncHandler(async (_req, res) => {
    res.json({
      success: true,
      data: {
        permissions: PERMISSIONS,
        groups: PERMISSION_GROUPS,
        keys: PERMISSION_KEYS,
        /*
         * The platform's job *shapes*, not job titles. A tenant's role names its own meaning;
         * this only tells the machinery whether somebody works a counter or a back office.
         */
        baseRoles: ROLES,
        scopeAxes: ['sites', 'areas', 'terminals', 'activities', 'resources'],
      },
    })
  }),

  create: asyncHandler(async (req, res) => {
    const body = bodySchema.parse(req.body)
    res.status(201).json({ success: true, data: await createRoleDefinition(tenantOf(), body) })
  }),

  update: asyncHandler(async (req, res) => {
    const patch = patchSchema.parse(req.body)
    res.json({ success: true, data: await updateRoleDefinition(tenantOf(), req.params.key, patch) })
  }),

  remove: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await removeRoleDefinition(tenantOf(), req.params.key) })
  }),

  /** What this job may be assigned to work — the employee form's only source of truth. */
  assignable: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await assignableForRole(tenantOf(), req.params.key) })
  }),
}
