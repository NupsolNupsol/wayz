import { test, expect, type Page } from '@playwright/test'
import { authToken, login, loginAgent, releaseStoredBooking, resetSession, storedShopDropBooking } from './helpers'

const COURIER = { email: 'courier.wayz@lockerflow.demo', password: 'Courier@123' }
const COURIER2 = { email: 'courier2.wayz@lockerflow.demo', password: 'Courier@123' }

test.beforeEach(async ({ page }) => resetSession(page))

const created: string[] = []
test.afterEach(async ({ page }) => {
  for (const id of created.splice(0)) await releaseStoredBooking(page, id)
})

async function loginCourier(page: Page, creds = COURIER) {
  await page.goto('/login')
  await page.getByTestId('login-email').fill(creds.email)
  await page.getByTestId('login-password').fill(creds.password)
  await page.getByTestId('login-submit').click()
  // A click that lands before React attaches does nothing. Retry only when the button is
  // idle again — a disabled one means the request is still in flight, so waiting is right.
  await page
    .waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 8_000 })
    .catch(async () => {
      if (await page.getByTestId('login-submit').isEnabled()) {
        await page.getByTestId('login-submit').click()
      }
    })

  await expect(page.getByTestId('courier-board')).toBeVisible()
}

async function apiDelivery(page: Page, bookingId: string, address = 'Rosewood Hotel, room 402') {
  const token = await authToken(page)
  const res = await page.request.post('/api/deliveries', {
    headers: { Authorization: `Bearer ${token}` },
    data: { bookingId, address, origin: 'AT_STORAGE' },
  })
  expect(res.ok(), `create delivery → ${res.status()} ${await res.text()}`).toBeTruthy()
  return (await res.json()).data._id as string
}

test('a courier signs in to their own workspace, not the counter', async ({ page }) => {
  await loginCourier(page)

  await expect(page.getByTestId('nav-courier-board')).toBeVisible()
  await expect(page.getByTestId('nav-courier-history')).toBeVisible()
  await expect(page.getByTestId('nav-pos')).toHaveCount(0)
  await expect(page.getByTestId('nav-shopdrop')).toHaveCount(0)

  await expect(page.getByTestId('courier-available')).toContainText('Sara Kamal')
  await page.screenshot({ path: 'test-artifacts/shots/courier-board.png', fullPage: true })

  await page.goto('/pos')
  await expect(page).toHaveURL(/\/courier/)
})

test('the agent raises a delivery from the booking console and it reaches the courier board', async ({ page }) => {
  await loginAgent(page, 'wayz')
  const { id } = await storedShopDropBooking(page, 'cust_wayz_1', 'pr_wayz_sd_s')
  created.push(id)

  await page.goto(`/bookings/${id}`)
  await page.getByTestId('booking-request-delivery').click()
  await expect(page.getByTestId('delivery-request-modal')).toBeVisible()

  await page.getByTestId('delivery-address').fill('Hyatt Regency, room 1108')
  await page.getByTestId('delivery-notes').fill('Leave with the concierge if she is out.')
  await page.getByTestId('delivery-request-submit').click()

  await expect(page.getByTestId('booking-open-delivery')).toBeVisible()
  await expect(page.getByTestId('booking-open-delivery')).toContainText('Hyatt Regency')
  await expect(page.getByTestId('booking-request-delivery')).toHaveCount(0)

  await page.goto('/deliveries')
  await expect(page.getByTestId('kiosk-delivery-table')).toContainText('Hyatt Regency')
  await page.screenshot({ path: 'test-artifacts/shots/kiosk-deliveries.png', fullPage: true })
})

test('a request the customer phoned in cannot be created until they are verified', async ({ page }) => {
  await loginAgent(page, 'wayz')
  const { id } = await storedShopDropBooking(page, 'cust_wayz_2', 'pr_wayz_sd_m')
  created.push(id)

  await page.goto(`/bookings/${id}`)
  await page.getByTestId('booking-request-delivery').click()
  await page.getByTestId('delivery-origin-CUSTOMER_CONTACT').click()

  await expect(page.getByTestId('delivery-verify-gate')).toBeVisible()
  await page.getByTestId('delivery-address').fill('Four Seasons, room 2201')
  await expect(page.getByTestId('delivery-request-submit')).toBeDisabled()

  await page.getByTestId('delivery-verify-open').click()
  await expect(page.getByTestId('verify-modal')).toBeVisible()
  await page.screenshot({ path: 'test-artifacts/shots/delivery-verify-gate.png', fullPage: true })
})

test('full handover across two sessions: courier claims, agent releases, courier scans out and delivers', async ({ page, browser }) => {
  await loginAgent(page, 'wayz')
  const stored = await storedShopDropBooking(page, 'cust_wayz_1', 'pr_wayz_sd_l')
  created.push(stored.id)

  const token = await authToken(page)
  const bookingRes = await page.request.get(`/api/bookings/${stored.id}`, { headers: { Authorization: `Bearer ${token}` } })
  const barcodes: string[] = (await bookingRes.json()).data.bags.map((b: { barcode: string }) => b.barcode)

  const dlvId = await apiDelivery(page, stored.id, 'Ritz-Carlton, room 705')

  const courierCtx = await browser.newContext()
  const courierPage = await courierCtx.newPage()
  await loginCourier(courierPage)

  await courierPage.getByTestId(`delivery-claim-${dlvId}`).click()
  await expect(courierPage.getByTestId('courier-task')).toBeVisible()
  await expect(courierPage).toHaveURL(new RegExp(`/courier/task/${dlvId}`))

  await courierPage.getByTestId('courier-request-release').click()
  await expect(courierPage.getByTestId('courier-waiting')).toBeVisible()
  await courierPage.screenshot({ path: 'test-artifacts/shots/courier-waiting.png', fullPage: true })

  await page.goto('/deliveries')
  await expect(page.getByTestId(`kiosk-waiting-${dlvId}`)).toBeVisible()
  await page.getByTestId(`kiosk-approve-${dlvId}`).click()
  await expect(page.getByTestId('delivery-approve-modal')).toBeVisible()
  await expect(page.getByTestId('delivery-approve-courier')).toContainText('Bilal Al-Harbi')

  await expect(page.getByTestId('delivery-approve-code')).toBeDisabled()
  await expect(page.getByTestId('delivery-approve-submit')).toBeDisabled()
  await page.screenshot({ path: 'test-artifacts/shots/delivery-approve.png', fullPage: true })

  await page.getByTestId('delivery-approve-confirm').check()
  await expect(page.getByTestId('delivery-approve-code')).toBeEnabled()
  await page.getByTestId('delivery-approve-code').fill('K7X2M9')
  await page.getByTestId('delivery-approve-submit').click()
  await expect(page.getByTestId('delivery-approve-modal')).toHaveCount(0)

  await courierPage.reload({ waitUntil: 'domcontentloaded' })
  await expect(courierPage.getByTestId('courier-compartment-code')).toBeVisible()
  await expect(courierPage.getByTestId('courier-code-value')).toHaveText('K7X2M9')
  await courierPage.screenshot({ path: 'test-artifacts/shots/courier-code.png', fullPage: true })

  const panel = courierPage.getByTestId('courier-scan-panel')
  for (const code of barcodes) await expect(panel).not.toContainText(code)

  await expect(courierPage.getByTestId('courier-confirm-pickup')).toBeDisabled()
  await courierPage.getByTestId('courier-scan-bag-1').click()
  await expect(courierPage.getByTestId('courier-bag-slot-1')).toContainText('scanned')
  await expect(courierPage.getByTestId('courier-confirm-pickup')).toBeDisabled()

  await courierPage.getByTestId('courier-scan-all').click()
  for (let i = 1; i <= barcodes.length; i++) {
    await expect(courierPage.getByTestId(`courier-bag-slot-${i}`)).toContainText('scanned')
  }
  await expect(courierPage.getByTestId('courier-confirm-pickup')).toBeEnabled()
  await courierPage.screenshot({ path: 'test-artifacts/shots/courier-scanned.png', fullPage: true })
  await courierPage.getByTestId('courier-confirm-pickup').click()

  await expect(courierPage.getByTestId('courier-deliver')).toBeVisible()
  await courierPage.screenshot({ path: 'test-artifacts/shots/courier-in-transit.png', fullPage: true })

  await courierPage.getByTestId('courier-deliver').click()
  await expect(courierPage.getByTestId('courier-timeline')).toContainText('Delivered')

  await page.goto(`/bookings/${stored.id}`)
  await expect(page.getByTestId('booking-detail')).toContainText('COMPLETED')
  await expect(page.getByTestId('booking-detail')).toContainText('PORTER')

  await courierCtx.close()
})

test('a wrong barcode is refused at the kiosk, not quietly accepted', async ({ page, browser }) => {
  await loginAgent(page, 'wayz')
  const mine = await storedShopDropBooking(page, 'cust_wayz_1', 'pr_wayz_sd_m')
  const other = await storedShopDropBooking(page, 'cust_wayz_3', 'pr_wayz_sd_s')
  created.push(mine.id, other.id)

  const token = await authToken(page)
  const otherRes = await page.request.get(`/api/bookings/${other.id}`, { headers: { Authorization: `Bearer ${token}` } })
  const foreignBarcode: string = (await otherRes.json()).data.bags[0].barcode

  const dlvId = await apiDelivery(page, mine.id, 'Somewhere in the mall')

  const courierCtx = await browser.newContext()
  const courierPage = await courierCtx.newPage()
  await loginCourier(courierPage)
  await courierPage.getByTestId(`delivery-claim-${dlvId}`).click()
  await courierPage.getByTestId('courier-request-release').click()

  await page.goto('/deliveries')
  await page.getByTestId(`kiosk-approve-${dlvId}`).click()
  await page.getByTestId('delivery-approve-confirm').check()
  await page.getByTestId('delivery-approve-code').fill('ZZ99')
  await page.getByTestId('delivery-approve-submit').click()

  await courierPage.reload({ waitUntil: 'domcontentloaded' })
  await expect(courierPage.getByTestId('courier-compartment-code')).toBeVisible()
  for (const code of [foreignBarcode, `${foreignBarcode}X`]) {
    await courierPage.getByTestId('courier-scan-input').fill(code)
    await courierPage.getByTestId('courier-scan-add').click()
  }
  await courierPage.getByTestId('courier-confirm-pickup').click()

  await expect(courierPage.getByTestId('toaster')).toContainText('do not belong to this customer')
  await expect(courierPage.getByTestId('courier-scan-panel')).toBeVisible()

  await courierCtx.close()
})

test('an expired compartment code strands nobody — the courier can ask the agent again', async ({ page, browser }) => {
  await loginAgent(page, 'wayz')
  const stored = await storedShopDropBooking(page, 'cust_wayz_1', 'pr_wayz_sd_xl')
  created.push(stored.id)
  const dlvId = await apiDelivery(page, stored.id, 'Expiry test address')

  const courierCtx = await browser.newContext()
  const courierPage = await courierCtx.newPage()
  await loginCourier(courierPage)
  await courierPage.getByTestId(`delivery-claim-${dlvId}`).click()
  await courierPage.getByTestId('courier-request-release').click()

  await page.goto('/deliveries')
  await page.getByTestId(`kiosk-approve-${dlvId}`).click()
  await page.getByTestId('delivery-approve-confirm').check()
  await page.getByTestId('delivery-approve-code').fill('OLD123')
  await page.getByTestId('delivery-approve-submit').click()

  await courierPage.route(`**/api/deliveries/${dlvId}`, async (route) => {
    const res = await route.fetch()
    const body = await res.json()
    body.data.delivery.compartmentCodeExpiresAt = new Date(Date.now() - 60_000).toISOString()
    await route.fulfill({ response: res, json: body })
  })

  await courierPage.reload({ waitUntil: 'domcontentloaded' })
  await expect(courierPage.getByTestId('courier-code-value')).toContainText('—')
  await expect(courierPage.getByTestId('courier-scan-panel')).toHaveCount(0)
  await courierPage.screenshot({ path: 'test-artifacts/shots/courier-code-expired.png', fullPage: true })

  await courierPage.unroute(`**/api/deliveries/${dlvId}`)
  await courierPage.getByTestId('courier-ask-again').click()
  await expect(courierPage.getByTestId('courier-waiting')).toBeVisible()

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId(`kiosk-waiting-${dlvId}`)).toBeVisible()

  await courierCtx.close()
})

test('a second courier cannot see or take a job that is already claimed', async ({ page, browser }) => {
  await loginAgent(page, 'wayz')
  const stored = await storedShopDropBooking(page, 'cust_wayz_2', 'pr_wayz_sd_m')
  created.push(stored.id)
  const dlvId = await apiDelivery(page, stored.id, 'Contested job')

  const firstCtx = await browser.newContext()
  const firstPage = await firstCtx.newPage()
  await loginCourier(firstPage)
  await firstPage.getByTestId(`delivery-claim-${dlvId}`).click()
  await expect(firstPage.getByTestId('courier-task')).toBeVisible()

  const secondCtx = await browser.newContext()
  const secondPage = await secondCtx.newPage()
  await loginCourier(secondPage, COURIER2)
  await expect(secondPage.getByTestId(`delivery-claim-${dlvId}`)).toHaveCount(0)

  await secondPage.goto(`/courier/task/${dlvId}`)
  await expect(secondPage.getByTestId('courier-task')).toBeVisible()
  await expect(secondPage.getByTestId('courier-request-release')).toHaveCount(0)

  await firstCtx.close()
  await secondCtx.close()
})

test('a manager can create a delivery agent account', async ({ page }) => {
  await login(page, 'manager')
  await expect(page.getByTestId('manager-overview')).toBeVisible()

  await page.goto('/manager/team')
  await page.getByTestId('team-add').click()
  await expect(page.getByTestId('team-create-modal')).toBeVisible()

  await page.getByTestId('team-role-button').click()
  await expect(page.getByTestId('team-role-opt-DELIVERY_AGENT')).toBeVisible()
  await page.screenshot({ path: 'test-artifacts/shots/manager-courier-role.png', fullPage: true })
})

test('the delivery contact uses the same phone field as the rest of the platform', async ({ page }) => {
  await loginAgent(page, 'wayz')
  const { id } = await storedShopDropBooking(page, 'cust_wayz_1', 'pr_wayz_sd_s')
  created.push(id)

  await page.goto(`/bookings/${id}`)
  await page.getByTestId('booking-request-delivery').click()
  await expect(page.getByTestId('delivery-request-modal')).toBeVisible()

  const phone = page.getByTestId('delivery-contact')
  await expect(phone, 'the country prefix picker is there, like on the customer form').toBeVisible()
  await expect(page.getByTestId('delivery-contact-country')).toBeVisible()

  const input = page.getByTestId('delivery-contact-number')
  await expect(input, "it opens on the customer's own number").not.toHaveValue('')

})
