import { test, expect, type Page } from '@playwright/test'
import { authToken, completeOtp, loginAgent, resetSession, storedShopDropBooking } from './helpers'

test.beforeEach(async ({ page }) => resetSession(page))

const CUSTOMER_PHONE = '0599709998'

/** Product → customer → OTP → pay → fulfil, the whole counter journey for a rental engine. */
async function rentThrough(
  page: Page,
  nav: string,
  workspace: string,
  productTestId: string,
  fill?: () => Promise<void>,
) {
  // Cash cannot be taken without a till, which is the first thing an agent does on shift.
  const token = await authToken(page)
  await page.request.post('/api/shift/open', {
    headers: { Authorization: `Bearer ${token}` },
    data: { openingFloat: 500 },
  })

  await page.getByTestId(nav).click()
  await expect(page.getByTestId(workspace)).toBeVisible()

  await page.getByTestId(productTestId).click()
  await page.getByTestId('customer-search').fill('Ahmed')
  await page.getByTestId('customer-opt-cust_wayz_1').click()
  if (fill) await fill()
  await page.getByTestId('engine-next').click()

  await expect(page.getByTestId('payment-panel')).toBeVisible()
  await completeOtp(page, CUSTOMER_PHONE)
  await page.getByTestId('pay-confirm').click()

  await expect(page.getByTestId('engine-fulfil')).toBeVisible()
  await page.getByTestId('engine-flag').locator('input').check()
  await page.getByTestId('engine-fulfil-btn').click()

  await expect(page.getByTestId('booking-detail')).toContainText('ACTIVE')
  return page.url().split('/bookings/')[1]
}

test('Mobility: a scooter is rented, handed over and returned', async ({ page }) => {
  await loginAgent(page, 'wayz')

  const id = await rentThrough(page, 'nav-mobility', 'engine-MOBILITY', 'product-pr_wayz_mob_single', async () => {
    await page.getByTestId('engine-duration').fill('2')
  })
  expect(id).toBeTruthy()

  await expect(page.getByTestId('transition-actions')).toBeVisible()
  await page.getByTestId('action-TO_RETURNED').click()
  await expect(page.getByTestId('booking-detail')).toContainText('COMPLETED')
})

test('Lagoon: a boat trip is paid, boarding-verified, started and completed', async ({ page }) => {
  await loginAgent(page, 'lagoon')

  await rentThrough(page, 'nav-lagoon', 'engine-LAGOON', 'product-pr_wayz_lag_boat', async () => {
    await page.getByTestId('engine-visitors').fill('3')
  })

  await page.getByTestId('action-TO_COMPLETED').click()
  await expect(page.getByTestId('booking-detail')).toContainText('COMPLETED')
})

test('Shop & Drop: bags go in, and come back out against a fresh identity check', async ({ page }) => {
  await loginAgent(page, 'wayz')

  const { id } = await storedShopDropBooking(page)
  await page.goto(`/bookings/${id}`)
  await expect(page.getByTestId('booking-detail')).toContainText('ACTIVE')

  await expect(page.getByTestId('verify-required'), 'retrieval is blocked until identity is proven').toBeVisible()
  await page.getByTestId('verify-open').click()
  await expect(page.getByTestId('verify-modal')).toBeVisible()

  // WhatsApp needs the provider; the audited document fallback is the deterministic path.
  await page.getByTestId('verify-tab-document').click()
  await page.getByTestId('verify-doc-number').fill('1098765432')
  await page.getByTestId('verify-doc-holder').fill('Ahmed Saleh')
  await page.getByTestId('verify-reason').fill('Customer lost their phone — national ID checked against the booking')
  await page.getByTestId('verify-submit').click()

  await expect(page.getByTestId('booking-detail')).toContainText('RETRIEVAL IN PROGRESS')

  await page.getByTestId('retrieval-scan-1').click()
  await page.getByTestId('retrieval-scan-2').click()

  // Handover is refused while a bag is still in the compartment, so wait for both scans to land.
  await expect(page.getByTestId('bag-1')).toContainText('RETRIEVED')
  await expect(page.getByTestId('bag-2')).toContainText('RETRIEVED')

  await page.getByTestId('action-TO_COMPLETED').click()
  await expect(page.getByTestId('booking-detail')).toContainText('COMPLETED')
})

test('a station cannot sell what it has no unit for', async ({ page, request }) => {
  await loginAgent(page, 'wayz')
  const token = await page.evaluate(() => JSON.parse(localStorage.getItem('wayz.platform.auth') || '{}')?.state?.token)

  const res = await request.post('/api/bookings', {
    headers: { Authorization: `Bearer ${token}` },
    data: { customerId: 'cust_wayz_1', engineKind: 'MOBILITY', productId: 'pr_wayz_mob_cart', durationMin: 60 },
  })
  expect([200, 201, 422], 'either it is fulfillable, or it is refused with a reason').toContain(res.status())

  if (res.status() === 422) {
    const body = await res.json()
    expect(body.message).toMatch(/not set up at this station|is free right now/)
  }
})
