import { test, expect } from '@playwright/test'
import { authToken, login, loginAgent, resetSession } from './helpers'

test.beforeEach(async ({ page }) => resetSession(page))

test('an agent only sees the activities they are assigned to in the sidebar', async ({ page }) => {
  await loginAgent(page, 'wayz')
  await expect(page.getByTestId('nav-shopdrop')).toBeVisible()
  await expect(page.getByTestId('nav-mobility')).toBeVisible()
  await expect(page.getByTestId('nav-lagoon')).toHaveCount(0)

  await resetSession(page)

  await loginAgent(page, 'lagoon')
  await expect(page.getByTestId('nav-lagoon')).toBeVisible()
  await expect(page.getByTestId('nav-shopdrop')).toHaveCount(0)
  await expect(page.getByTestId('nav-mobility')).toHaveCount(0)
})

test('typing the address of another activity bounces the agent back', async ({ page }) => {
  await loginAgent(page, 'lagoon')

  await page.goto('/shop-drop')
  await expect(page).toHaveURL(/\/dashboard/)

  await page.goto('/mobility')
  await expect(page).toHaveURL(/\/dashboard/)

  await page.goto('/lagoon')
  await expect(page.getByTestId('engine-LAGOON')).toBeVisible()
})

test('the new-transaction screen offers only the assigned activities', async ({ page }) => {
  await loginAgent(page, 'lagoon')
  await page.getByTestId('nav-pos').click()
  await expect(page.getByTestId('engine-LAGOON')).toBeVisible()
  await expect(page.getByTestId('engine-SHOP_AND_DROP')).toHaveCount(0)
  await expect(page.getByTestId('engine-MOBILITY')).toHaveCount(0)
})

test('the kiosk manager workspace is gone', async ({ page }) => {
  await login(page, 'manager')
  await expect(page.getByTestId('manager-overview')).toBeVisible()

  await page.goto('/kiosk')
  await expect(page.getByTestId('not-found')).toBeVisible()

  await page.goto('/login')
  await expect(page.getByText('Kiosk manager')).toHaveCount(0)
})

test('creating an agent forces an activity, and Shop & Drop forces a kiosk', async ({ page }) => {
  await login(page, 'admin')
  await page.goto('/manager/team')
  await expect(page.getByTestId('team-table')).toBeVisible()

  await page.getByTestId('team-add').click()
  await expect(page.getByTestId('team-create-modal')).toBeVisible()

  const email = `activity.${Date.now()}@lockerflow.demo`
  await page.getByTestId('team-name').fill('Activity Hire')
  await page.getByTestId('team-email').fill(email)

  await expect(page.getByTestId('team-activities')).toBeVisible()
  await expect(page.getByTestId('team-create-submit'), 'no activity picked yet').toBeDisabled()

  await page.getByTestId('team-activity-SHOP_AND_DROP').click()
  await expect(page.getByTestId('team-kiosk'), 'bags need a kiosk').toBeVisible()

  await page.getByTestId('team-activity-SHOP_AND_DROP').click()
  await page.getByTestId('team-activity-LAGOON').click()
  await expect(page.getByTestId('team-kiosk'), 'the lagoon has no lockers').toHaveCount(0)
  await expect(page.getByTestId('team-create-submit')).toBeEnabled()

  await page.getByTestId('team-create-submit').click()
  await expect(page.getByTestId('team-create-modal')).toHaveCount(0)

  await expect(page.getByTestId('team-table').getByText(email)).toBeVisible()
  const row = page.getByTestId('team-table').locator('tr', { hasText: email })
  await expect(row).toContainText('Lagoon')

  // Leave the tenant as it was found: a live hire would show up as uncharged payroll elsewhere.
  const token = await authToken(page)
  const staff = await page.request.get('/api/manager/staff', { headers: { Authorization: `Bearer ${token}` } })
  const hire = (await staff.json()).data.find((s: { email: string }) => s.email === email)
  await page.request.patch(`/api/manager/staff/${hire._id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { active: false },
  })
})

test('the phone field is the same country-code input everywhere', async ({ page }) => {
  await login(page, 'admin')

  await page.goto('/manager/team')
  await expect(page.getByTestId('team-table')).toBeVisible()
  await page.getByTestId('team-add').click()
  await expect(page.getByTestId('team-phone-country')).toBeVisible()
  await expect(page.getByTestId('team-phone-number')).toBeVisible()
  await page.getByTestId('team-phone-country').click()
  await page.getByTestId('team-phone-search').fill('united arab')
  await page.getByTestId('team-phone-opt-AE').click()
  await expect(page.getByTestId('team-phone-country')).toContainText('+971')

  await page.goto('/admin/company')
  await expect(page.getByTestId('company-contact-phone-country')).toBeVisible()
  await expect(page.getByTestId('company-contact-phone-number')).toBeVisible()
})
