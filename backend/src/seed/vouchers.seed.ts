import { Voucher, VoucherCampaign } from '../models/index.js'

/**
 * A live batch of discount codes so the demo can be tested the moment it is seeded:
 * fixed codes, so a tester can read them out of this file or off the batch page.
 */
const CODES = [
  'WZ-4F7K2Q', 'WZ-9HTM3D', 'WZ-2BQX8N', 'WZ-6LVR5P', 'WZ-7CJD4W',
  'WZ-3XKN9F', 'WZ-8PWT2M', 'WZ-5RDH6B', 'WZ-QN4V7L', 'WZ-MJ8C3T',
]

const LAGOON_CODES = ['LAG-5TQ9WD', 'LAG-2HMK7B', 'LAG-8VXR4N']

export async function seedVouchers() {
  const now = new Date()
  const inThreeMonths = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  await VoucherCampaign.insertMany([
    {
      _id: 'camp_wayz_opening',
      tenantId: 'wayz',
      name: 'Opening week',
      percent: 25,
      quantity: CODES.length,
      engineKinds: [],
      expiresAt: inThreeMonths,
      note: 'Handed out at the mall entrance during opening week.',
      createdBy: 'usr_admin_wayz',
      active: true,
    },
    {
      _id: 'camp_wayz_lagoon',
      tenantId: 'wayz',
      name: 'Lagoon summer',
      percent: 50,
      quantity: LAGOON_CODES.length,
      engineKinds: ['LAGOON'],
      expiresAt: inThreeMonths,
      note: 'Boat trips only.',
      createdBy: 'usr_admin_wayz',
      active: true,
    },
  ])

  await Voucher.insertMany([
    ...CODES.map((code) => ({
      tenantId: 'wayz',
      campaignId: 'camp_wayz_opening',
      code,
      percent: 25,
      engineKinds: [],
      expiresAt: inThreeMonths,
      status: 'ISSUED' as const,
    })),
    ...LAGOON_CODES.map((code) => ({
      tenantId: 'wayz',
      campaignId: 'camp_wayz_lagoon',
      code,
      percent: 50,
      engineKinds: ['LAGOON'],
      expiresAt: inThreeMonths,
      status: 'ISSUED' as const,
    })),
  ])

  return CODES.length + LAGOON_CODES.length
}
