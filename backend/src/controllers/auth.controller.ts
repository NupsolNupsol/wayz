import { z } from 'zod'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { acceptInvitation, buildMe, login, readInvitation, signOut } from '../services/auth.service.js'
import { organisationForLogin } from '../services/auth.service.js'
import { runInOrg } from '../platform/orgScope.js'
import { verifyPlatformAdmin } from '../services/platform.service.js'
import { signPlatformToken } from '../utils/jwt.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  /**
   * Which organisation to sign in to.
   *
   * Optional, and normally absent: the login page is one neutral door for everybody, so the
   * organisation is worked out from the account itself. Kept for the case of one address
   * belonging to two organisations, where somebody has to say which.
   */
  tenant: z.string().trim().min(1).optional(),
})

const acceptSchema = z.object({
  password: z.string().min(1),
  confirmPassword: z.string().min(1),
})

export const authController = {
  login: asyncHandler(async (req, res) => {
    const { email, password, tenant } = loginSchema.parse(req.body)
    /*
     * Sign-in is the one request that arrives with no organisation.
     *
     * So it is found from the account, and the attempt then runs scoped to it — which is what
     * lets a single neutral login page serve every organisation, and lets the answer decide
     * whose branding the session wears.
     */
    /*
     * Whoever runs the platform signs in at the same door as everybody else.
     *
     * Checked first, and by address rather than by any flag the caller sends — one neutral
     * login page means the account decides what it opens, and that has to hold for this
     * account too. A platform administrator has no organisation, so the organisation lookup
     * below would refuse them outright; asking here is what keeps that lookup honest for
     * everybody else.
     */
    const platformAdmin = await verifyPlatformAdmin(email, password)
    if (platformAdmin) {
      res.json({
        success: true,
        data: {
          token: signPlatformToken({
            kind: 'PLATFORM',
            sub: platformAdmin._id,
            email: platformAdmin.email,
            name: platformAdmin.fullName,
          }),
          platform: { id: platformAdmin._id, email: platformAdmin.email, name: platformAdmin.fullName },
        },
      })
      return
    }

    const organizationId = await organisationForLogin(email, tenant)
    res.json({ success: true, data: await runInOrg(organizationId, () => login(email, password)) })
  }),

  invitation: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await readInvitation(req.params.token) })
  }),

  acceptInvitation: asyncHandler(async (req, res) => {
    const body = acceptSchema.parse(req.body)
    res.json({ success: true, data: await acceptInvitation(req.params.token, body.password, body.confirmPassword) })
  }),

  logout: asyncHandler(async (req, res) => {
    if (!req.auth) throw ApiError.unauthorized()
    res.json({ success: true, data: await signOut(req.auth.tenantId, req.auth.sub) })
  }),

  me: asyncHandler(async (req, res) => {
    res.json({ success: true, data: await buildMe(req.auth!.sub) })
  }),
}
