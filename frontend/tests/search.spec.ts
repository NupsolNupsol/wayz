import { test, expect } from '@playwright/test'
import { authToken, login, loginAgent, resetSession } from './helpers'

test.beforeEach(async ({ page }) => resetSession(page))

test('the agent searches a booking reference and lands on the booking', async ({ page }) => {
  await loginAgent(page, 'wayz')

  const token = await authToken(page)
  const res = await page.request.get('/api/bookings', { headers: { Authorization: `Bearer ${token}` } })
  const bookings = (await res.json()).data as { _id: string; ref: string }[]
  const sample = bookings[0]
  expect(sample, 'the seed leaves a booking to look for').toBeTruthy()

  await page.getByTestId('global-search').fill(sample.ref)
  await expect(page.getByTestId('search-results')).toBeVisible()
  await page.getByTestId(`search-hit-${sample._id}`).click()

  await expect(page).toHaveURL(new RegExp(`/bookings/${sample._id}`))
  await expect(page.getByTestId('booking-detail')).toContainText(sample.ref)
  await expect(page.getByTestId('global-search'), 'the box clears once you land').toHaveValue('')
})

test('a customer can be found by name or by phone', async ({ page }) => {
  await loginAgent(page, 'wayz')

  await page.getByTestId('global-search').fill('Ahmed')
  await expect(page.getByTestId('search-results')).toContainText('Customer')

  await page.getByTestId('global-search').fill('0599709998')
  await expect(page.getByTestId('search-results')).toContainText('Ahmed')
  await page.getByTestId('search-hit-cust_wayz_1').click()
  await expect(page).toHaveURL(/\/customers\/cust_wayz_1/)
})

test('nothing matching says so instead of sitting there empty', async ({ page }) => {
  await loginAgent(page, 'wayz')
  await page.getByTestId('global-search').fill('zzzzz-nothing-like-this')
  await expect(page.getByTestId('search-empty')).toBeVisible()
})

test('the manager searches the same records and lands in the manager workspace', async ({ page }) => {
  await login(page, 'manager')
  await expect(page.getByTestId('manager-overview')).toBeVisible()

  await page.getByTestId('global-search').fill('Ahmed')
  await expect(page.getByTestId('search-results')).toBeVisible()
  await page.getByTestId('search-hit-cust_wayz_1').click()
  await expect(page).toHaveURL(/\/manager\/customers\/cust_wayz_1/)
})

test('the accountant searches money, and HR has no search at all', async ({ page }) => {
  await login(page, 'accountant')
  await expect(page.getByTestId('accounting-dashboard')).toBeVisible()

  await page.getByTestId('global-search').fill('pay-')
  await expect(page.getByTestId('search-results')).toContainText('Payment')
  await page.getByTestId('search-results').locator('button').first().click()
  await expect(page).toHaveURL(/\/accounting\/settlement\/payments\//)

  await resetSession(page)
  await login(page, 'hr')
  await expect(page.getByTestId('hr-costs')).toBeVisible()
  await expect(page.getByTestId('global-search'), 'HR has nothing to search').toHaveCount(0)
})
