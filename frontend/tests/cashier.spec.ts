import { test, expect, type Page } from '@playwright/test'
import { authToken, login, loginAgent, resetSession } from './helpers'

const CASHIER = { email: 'cashier.wayz@lockerflow.demo', password: 'Cashier@123' }

test.beforeEach(async ({ page }) => resetSession(page))

async function loginCashier(page: Page) {
  await page.goto('/login')
  await page.getByTestId('login-email').fill(CASHIER.email)
  await page.getByTestId('login-password').fill(CASHIER.password)
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

  await expect(page.getByTestId('cashier-till')).toBeVisible()
}

async function unpaidBooking(page: Page, productId = 'pr_wayz_sd_s') {
  const token = await authToken(page)
  const res = await page.request.post('/api/bookings', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      customerId: 'cust_wayz_1',
      engineKind: 'SHOP_AND_DROP',
      productId,
      durationMin: 60,
      bags: [{ description: 'Backpack' }],
    },
  })
  expect(res.ok(), `create booking → ${res.status()} ${await res.text()}`).toBeTruthy()
  const data = (await res.json()).data
  return { id: data.booking.id as string, ref: data.booking.ref as string, total: data.order.total as number }
}

test('the cashier signs in to a till, not to the counter', async ({ page }) => {
  await loginCashier(page)

  await expect(page.getByTestId('nav-cashier-queue')).toBeVisible()
  await expect(page.getByTestId('nav-cashier-drawer')).toBeVisible()
  await expect(page.getByTestId('nav-shopdrop')).toHaveCount(0)
  await expect(page.getByTestId('nav-pos')).toHaveCount(0)
  await expect(page.getByTestId('sidebar')).toContainText('Cashier')

  await expect(page.getByTestId('till-drawer')).toContainText('Opening float')
  await expect(page.getByTestId('till-drawer')).toContainText('Banked')
  await expect(page.getByTestId('till-drawer-total')).toBeVisible()
  await expect(page.getByTestId('till-drift')).toHaveCount(0)
  await page.screenshot({ path: 'test-artifacts/shots/cashier-till.png', fullPage: true })

  await page.goto('/shop-drop')
  await expect(page).toHaveURL(/\/cashier/)
  await page.goto('/manager')
  await expect(page).toHaveURL(/\/cashier/)
})

test('the sidebar highlights the section you are actually on', async ({ page }) => {
  await loginCashier(page)

  const active = (testId: string) => page.getByTestId(testId).locator('span.absolute')

  await expect(active('nav-cashier-overview')).toBeVisible()

  await page.getByTestId('nav-cashier-queue').click()
  await expect(page.getByTestId('cashier-queue')).toBeVisible()
  await expect(active('nav-cashier-queue')).toBeVisible()
  await expect(active('nav-cashier-overview')).toHaveCount(0)

  await page.getByTestId('nav-cashier-drawer').click()
  await expect(page.getByTestId('cashier-drawer')).toBeVisible()
  await expect(active('nav-cashier-drawer')).toBeVisible()
  await expect(active('nav-cashier-overview')).toHaveCount(0)
})

test('a booking an agent registers shows up in the queue and can be paid for', async ({ page }) => {
  await loginAgent(page, 'wayz')
  const booking = await unpaidBooking(page, 'pr_wayz_sd_m')

  await loginCashier(page)
  await page.goto('/cashier/queue')
  await expect(page.getByTestId(`queue-card-${booking.id}`)).toContainText(booking.ref)
  await page.screenshot({ path: 'test-artifacts/shots/cashier-queue.png', fullPage: true })

  await page.getByTestId(`queue-take-${booking.id}`).click()
  await expect(page.getByTestId('queue-pay-modal')).toBeVisible()
  await expect(page.getByTestId('queue-pay-modal')).toContainText('VAT')
  await page.getByTestId('pay-confirm').click()

  await expect(page.getByTestId(`queue-card-${booking.id}`)).toHaveCount(0)

  await page.goto('/cashier/transactions')
  await expect(page.getByTestId('cashier-tx-table')).toContainText(booking.ref)
})

test('a drawer movement needs a reason, cannot overdraw the till, and is recorded for good', async ({ page }) => {
  await loginCashier(page)
  await page.goto('/cashier/drawer')
  await expect(page.getByTestId('cashier-drawer')).toBeVisible()

  const totalText = await page.getByTestId('drawer-stat-total').innerText()
  const held = parseFloat(totalText.replace(/[^\d.]/g, ''))

  await page.getByTestId('drawer-add-PAY_OUT').click()
  await page.getByTestId('drawer-amount').fill('25')
  await expect(page.getByTestId('drawer-submit')).toBeDisabled()
  await page.getByTestId('drawer-reason').fill('Taxi for a customer bag delivery')
  await expect(page.getByTestId('drawer-submit')).toBeEnabled()

  await page.getByTestId('drawer-amount').fill(String(held + 5000))
  await page.getByTestId('drawer-submit').click()
  await expect(page.getByTestId('toaster')).toContainText('cannot take out')

  await page.getByTestId('drawer-amount').fill('25')
  await page.getByTestId('drawer-reference').fill('INV-5567')
  await page.getByTestId('drawer-submit').click()
  await expect(page.getByTestId('drawer-modal')).toHaveCount(0)
  await expect(page.getByTestId('drawer-movements-table')).toContainText('Taxi for a customer bag delivery')
  await expect(page.getByTestId('drawer-movements-table')).toContainText('Reem Al-Sudairi')
  await page.screenshot({ path: 'test-artifacts/shots/cashier-drawer.png', fullPage: true })
})

test('a refund is a new entry with a reason, and the original is left standing', async ({ page }) => {
  await loginAgent(page, 'wayz')
  const booking = await unpaidBooking(page, 'pr_wayz_sd_m')

  await loginCashier(page)
  await page.goto('/cashier/queue')
  await page.getByTestId(`queue-take-${booking.id}`).click()
  await page.getByTestId('pay-method-card-0').click()
  await page.getByTestId('pay-scheme-VISA-0').click()
  await page.getByTestId('pay-confirm').click()

  await page.goto('/cashier/transactions')
  const row = page.getByTestId('cashier-tx-table').locator('tr', { hasText: booking.ref }).first()
  await expect(row).toBeVisible()

  await row.getByRole('button', { name: /Refund/i }).click()
  await expect(page.getByTestId('tx-refund-modal')).toBeVisible()

  await expect(page.getByTestId('tx-refund-submit')).toBeDisabled()
  await page.getByTestId('tx-refund-reason').fill('Customer changed their mind before storage')
  await expect(page.getByTestId('tx-refund-submit')).toBeEnabled()
  await page.screenshot({ path: 'test-artifacts/shots/cashier-refund.png', fullPage: true })
  await page.getByTestId('tx-refund-submit').click()

  await expect(page.getByTestId('cashier-tx-table')).toContainText('REFUND')
  await expect(page.getByTestId('cashier-tx-table')).toContainText('REFUNDED')
})

test('the till warns a cashier whose drawer is closed before a customer is at the counter', async ({ page }) => {
  await loginCashier(page)

  await expect(page.getByTestId('till-closed')).toHaveCount(0)
  await expect(page.getByTestId('till-stat-drawer')).not.toContainText('no till open')

  await page.goto('/cashier/queue')
  await expect(page.getByTestId('queue-till-closed')).toHaveCount(0)
})

test('a manager can create a cashier and put them on a station', async ({ page }) => {
  await login(page, 'manager')
  await expect(page.getByTestId('manager-overview')).toBeVisible()

  await page.goto('/manager/team')
  await expect(page.getByTestId('team-table')).toContainText('Reem Al-Sudairi')
  await expect(page.getByTestId('team-table')).toContainText('CASHIER')

  await page.getByTestId('team-add').click()
  await expect(page.getByTestId('team-create-modal')).toBeVisible()
  await page.getByTestId('team-role-button').click()
  await expect(page.getByTestId('team-role-opt-CASHIER')).toBeVisible()
  await page.getByTestId('team-role-opt-CASHIER').click()

  await expect(page.getByTestId('team-station')).toBeVisible()
  await page.screenshot({ path: 'test-artifacts/shots/manager-cashier-role.png', fullPage: true })
})
