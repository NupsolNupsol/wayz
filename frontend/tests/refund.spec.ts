import { test, expect, type Page } from '@playwright/test'
import { authToken, login, loginAgent, resetSession } from './helpers'

test.beforeEach(async ({ page }) => resetSession(page))

const money = (text: string) => Number((text.match(/-?[\d,]+\.\d{2}/) ?? ['0'])[0].replaceAll(',', ''))

/** A paid Mobility rental, opened on its own page — what the agent is looking at. */
async function paidBooking(page: Page): Promise<{ id: string; total: number }> {
  const token = await authToken(page)
  const headers = { Authorization: `Bearer ${token}` }
  await page.request.post('/api/shift/open', { headers, data: { openingFloat: 500 } })

  const res = await page.request.post('/api/bookings', {
    headers,
    data: { customerId: 'cust_wayz_1', engineKind: 'MOBILITY', productId: 'pr_wayz_mob_single', durationMin: 60 },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const created = (await res.json()).data
  const id = created.booking.id as string
  const total = created.order.total as number

  const paid = await page.request.post(`/api/bookings/${id}/pay`, {
    headers,
    data: { splits: [{ method: 'CASH', amount: total }] },
  })
  expect(paid.ok(), await paid.text()).toBeTruthy()
  return { id, total }
}

test('the agent refunds a booking from its own page, and it shows on the booking', async ({ page }) => {
  await loginAgent(page, 'wayz')
  const { id, total } = await paidBooking(page)

  await page.goto(`/bookings/${id}`)
  await expect(page.getByTestId('booking-detail')).toBeVisible()

  await page.getByTestId('booking-refund').click()
  await expect(page.getByTestId('refund-modal')).toBeVisible()

  const amount = page.getByTestId('refund-amount')
  await expect(amount, 'it defaults to everything the customer paid').toHaveValue(String(total))
  await expect(page.getByTestId('refund-submit'), 'a reason is required').toBeDisabled()

  await page.getByTestId('refund-reason').fill('Customer changed their mind at the counter')
  await expect(page.getByTestId('refund-submit')).toBeEnabled()
  await page.getByTestId('refund-submit').click()

  await expect(page.getByTestId('refund-modal')).toHaveCount(0)
  await expect(page.getByTestId('booking-refunds')).toBeVisible()
  await expect(page.getByTestId('booking-refunded-total')).toContainText(total.toFixed(2))
  await expect(page.getByTestId('booking-refund-0')).toContainText('changed their mind')
  await expect(page.getByTestId('booking-refund-0')).toContainText('Omar')

  await expect(page.getByTestId('booking-refund'), 'nothing is left to give back').toHaveCount(0)
  await page.screenshot({ path: 'test-artifacts/shots/booking-refunded.png', fullPage: true })
})

test('a partial refund leaves the rest available, and the amount cannot exceed it', async ({ page }) => {
  await loginAgent(page, 'wayz')
  const { id, total } = await paidBooking(page)
  const half = Math.round(total * 50) / 100

  await page.goto(`/bookings/${id}`)
  await page.getByTestId('booking-refund').click()

  const amount = page.getByTestId('refund-amount')
  await amount.fill(String(total + 50))
  await page.getByTestId('refund-reason').fill('Trying to give back more than was taken')
  await expect(amount, 'the field will not go above what is left').toHaveValue(String(total))

  await amount.fill(String(half))
  await page.getByTestId('refund-reason').fill('Half the session was unusable')
  await page.getByTestId('refund-submit').click()

  await expect(page.getByTestId('booking-refunds')).toBeVisible()
  expect(money(await page.getByTestId('booking-refunded-total').innerText())).toBeCloseTo(half, 2)
  await expect(page.getByTestId('booking-refund'), 'the rest can still be refunded').toBeVisible()
})

test('the refund reaches the accountant as a refund and the admin as an audited action', async ({ page }) => {
  await loginAgent(page, 'wayz')
  const { id, total } = await paidBooking(page)

  await page.goto(`/bookings/${id}`)
  await page.getByTestId('booking-refund').click()
  await page.getByTestId('refund-reason').fill('Scooter was faulty on handover')
  await page.getByTestId('refund-submit').click()
  await expect(page.getByTestId('booking-refunds')).toBeVisible()

  await resetSession(page)
  await login(page, 'admin')
  await expect(page.getByTestId('admin-overview')).toBeVisible()
  await page.goto('/admin/audit')
  await expect(page.getByTestId('admin-audit-table')).toBeVisible()

  await page.getByTestId('filter-action').click()
  await page.getByTestId('filter-pop-action').locator('input').fill('refunded')
  await expect(page.getByTestId('admin-audit-table')).toContainText('booking refunded')
  await expect(page.getByTestId('admin-audit-table')).toContainText('faulty on handover')

  await resetSession(page)
  await login(page, 'accountant')
  await expect(page.getByTestId('accounting-dashboard')).toBeVisible()
  await page.goto('/accounting/settlement/payments')
  await expect(page.getByTestId('payments-page')).toBeVisible()
  await page.getByTestId('filter-kind').click()
  await page.getByTestId('filter-pop-kind').getByText('REFUND', { exact: true }).click()
  await expect(page.getByTestId('payments-table')).toContainText('REFUND')
  expect(total).toBeGreaterThan(0)
})
