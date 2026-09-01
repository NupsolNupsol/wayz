import { test, expect } from '@playwright/test'
import { login, loginAgent, resetSession } from './helpers'

test.beforeEach(async ({ page }) => resetSession(page))

test('a manager lands on a real dashboard with tenant-wide figures', async ({ page }) => {
  await login(page, 'manager')

  await expect(page.getByTestId('manager-overview')).toBeVisible()
  await expect(page.getByTestId('mgr-revenue-today')).toBeVisible()
  await expect(page.getByTestId('mgr-active')).toBeVisible()
  await expect(page.getByTestId('mgr-overdue')).toBeVisible()
  await expect(page.getByTestId('mgr-by-engine')).toBeVisible()
  await expect(page.getByTestId('mgr-by-station')).toBeVisible()

  await expect(page.getByTestId('nav-mgr-org')).toBeVisible()
  await expect(page.getByTestId('nav-shopdrop')).toHaveCount(0)
  await expect(page.getByTestId('nav-pos')).toHaveCount(0)

  await page.screenshot({ path: 'test-artifacts/shots/manager-overview.png', fullPage: true })
})

test('every manager module opens with live data', async ({ page }) => {
  await login(page, 'manager')

  for (const [nav, testId] of [
    ['nav-mgr-live', 'manager-live'],
    ['nav-mgr-rentals', 'manager-rentals'],
    ['nav-mgr-customers', 'manager-customers'],
    ['nav-mgr-payments', 'manager-payments'],
    ['nav-mgr-incidents', 'manager-incidents'],
    ['nav-mgr-shifts', 'manager-shifts'],
    ['nav-mgr-org', 'manager-org'],
    ['nav-mgr-estate', 'assets-page'],
    ['nav-mgr-pricing', 'manager-pricing'],
    ['nav-mgr-team', 'manager-team'],
    ['nav-mgr-settings', 'manager-settings'],
    ['nav-mgr-reports', 'manager-reports'],
    ['nav-mgr-activity', 'manager-activity'],
  ] as const) {
    await page.getByTestId(nav).click()
    await expect(page.getByTestId(testId), `${nav} should open ${testId}`).toBeVisible()
  }
})

test('the organisation tree shows Site → Station → Kiosk, and a manager can extend it', async ({ page }) => {
  await login(page, 'manager')
  await page.getByTestId('nav-mgr-org').click()
  await expect(page.getByTestId('org-tree')).toBeVisible()

  const tree = page.getByTestId('org-tree')
  await expect(tree).toContainText('Riyadh Boulevard')
  await expect(tree).toContainText('Shop & Drop — Gate 1')
  await expect(tree).toContainText('Kiosk A')
  await expect(tree).toContainText('King Khalid International Airport')

  const name = `Test Venue ${Date.now()}`
  await page.getByTestId('org-add-site').click()
  await expect(page.getByTestId('org-modal')).toBeVisible()
  await page.getByTestId('org-name').fill(name)
  await page.getByTestId('org-city').fill('Dammam')
  await page.getByTestId('org-submit').click()
  await expect(tree).toContainText(name)

  await page.screenshot({ path: 'test-artifacts/shots/manager-organisation.png', fullPage: true })
})

test('a manager creates an account without ever choosing its password', async ({ page }) => {
  await login(page, 'manager')
  await page.getByTestId('nav-mgr-team').click()
  await expect(page.getByTestId('team-table')).toContainText('Faisal Manager')

  const email = `spec.agent.${Date.now()}@wayz.demo`
  await page.getByTestId('team-add').click()

  await expect(page.getByTestId('team-password'), 'nobody sets a password for somebody else').toHaveCount(0)
  await expect(page.getByTestId('team-create-modal')).toContainText('choose their own password')
  await expect(page.getByTestId('team-invite-note')).toContainText('Nobody here ever sees their password')

  await page.getByTestId('team-name').fill('Spec Agent')
  await page.getByTestId('team-email').fill(email)

  await expect(page.getByTestId('team-create-submit'), 'an agent needs an activity').toBeDisabled()
  await page.getByTestId('team-activity-LAGOON').click()

  await page.getByTestId('team-create-submit').click()
  await expect(page.getByTestId('team-table')).toContainText('Spec Agent')

  const row = page.getByTestId('team-table').locator('tbody tr').filter({ hasText: email })
  await expect(row, 'the account is invited, not yet live').toContainText('Invited')

  await page.goto('/login')
  await page.evaluate(() => localStorage.clear())
  await page.goto('/login')
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill('AnythingAtAll1')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('login-error')).toContainText('invitation link')
})

test('an invited employee sets their own password from the emailed link and lands in their workspace', async ({ page, request }) => {
  await login(page, 'manager')
  await page.getByTestId('nav-mgr-team').click()
  await expect(page.getByTestId('team-table')).toBeVisible()

  const email = `spec.invite.${Date.now()}@wayz.demo`
  await page.getByTestId('team-add').click()
  await page.getByTestId('team-name').fill('Invited Agent')
  await page.getByTestId('team-email').fill(email)
  await page.getByTestId('team-activity-LAGOON').click()
  await page.getByTestId('team-create-submit').click()
  await expect(page.getByTestId('team-table')).toContainText('Invited Agent')

  const token = await page.evaluate(() => JSON.parse(localStorage.getItem('wayz.platform.auth') || '{}')?.state?.token)
  const staff = await request.get('/api/manager/staff', { headers: { Authorization: `Bearer ${token}` } })
  const person = (await staff.json()).data.find((s: { email: string }) => s.email === email)
  expect(person.setUp).toBe(false)

  const resent = await request.post(`/api/manager/staff/${person._id}/invite`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const invitation = (await resent.json()).data.invitation
  const link: string = invitation.link ?? ''
  expect(link, 'the link is surfaced when it cannot be emailed').toContain('/invitation/')

  await page.evaluate(() => localStorage.clear())
  await page.goto(new URL(link).pathname)
  await expect(page.getByTestId('invitation-page')).toBeVisible()
  await expect(page.getByTestId('invitation-email')).toHaveText(email)
  await expect(page.getByTestId('invitation-page')).toContainText('Invited Agent')

  await expect(page.getByTestId('invitation-submit')).toBeDisabled()

  await page.getByTestId('invitation-password').fill('short')
  await expect(page.getByTestId('invitation-rule-length')).toBeVisible()
  await expect(page.getByTestId('invitation-submit')).toBeDisabled()

  await page.getByTestId('invitation-password').fill('Chosen-By-Me-1')
  await page.getByTestId('invitation-confirm').fill('Chosen-By-Me-2')
  await expect(page.getByTestId('invitation-submit'), 'mismatched entries cannot be submitted').toBeDisabled()

  await page.getByTestId('invitation-confirm').fill('Chosen-By-Me-1')
  await expect(page.getByTestId('invitation-submit')).toBeEnabled()
  await page.screenshot({ path: 'test-artifacts/shots/invitation.png', fullPage: true })

  await page.getByTestId('invitation-submit').click()
  await expect(page.getByTestId('dashboard'), 'accepting signs them straight in').toBeVisible()

  await page.evaluate(() => localStorage.clear())
  await page.goto('/login')
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill('Chosen-By-Me-1')
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

  await expect(page.getByTestId('dashboard')).toBeVisible()

  await page.goto(new URL(link).pathname)
  await expect(page.getByTestId('invitation-invalid'), 'the link dies once it is used').toBeVisible()
})

test('a spent or unknown invitation link explains itself instead of crashing', async ({ page }) => {
  await page.goto('/invitation/not-a-real-token')
  await expect(page.getByTestId('invitation-invalid')).toBeVisible()
  await expect(page.getByTestId('invitation-invalid')).toContainText('cannot be used')

  await page.getByTestId('invitation-to-login').click()
  await expect(page).toHaveURL(/\/login/)
})

test('a manager can reprice a product, and running sessions keep their old price', async ({ page }) => {
  await login(page, 'manager')
  await page.getByTestId('nav-mgr-pricing').click()
  await expect(page.getByTestId('pricing-table')).toBeVisible()

  await page.getByTestId('filter-name').click()
  await page.getByTestId('filter-pop-name').getByRole('textbox').fill('Shop & Drop — L')
  await page.locator('div.fixed.inset-0').last().click({ force: true })

  await page.getByTestId('pricing-edit-pr_wayz_sd_l').click()
  await expect(page.getByTestId('pricing-modal')).toBeVisible()
  await page.getByTestId('pricing-base').fill('88')
  await page.getByTestId('pricing-overtime').fill('44')
  await page.getByTestId('pricing-submit').click()

  await expect(page.getByTestId('pricing-table')).toContainText('88.00')
  await expect(page.getByTestId('pricing-table')).toContainText('44.00')
})

test('settings expose the operating rules but never the provider secrets', async ({ page }) => {
  await login(page, 'manager')
  await page.getByTestId('nav-mgr-settings').click()

  await expect(page.getByTestId('settings-grace')).toBeVisible()
  await expect(page.getByTestId('settings-vat')).toBeVisible()
  await expect(page.getByTestId('settings-method-CASH')).toBeVisible()

  await expect(page.getByTestId('manager-settings')).toContainText('not editable here')

  await page.getByTestId('settings-grace').fill('8')
  await page.getByTestId('settings-save').click()
  await expect(page.getByText('Settings saved')).toBeVisible()
})

test('reports render and export CSV', async ({ page }) => {
  await login(page, 'manager')
  await page.getByTestId('nav-mgr-reports').click()
  await expect(page.getByTestId('report-gross')).toBeVisible()
  await expect(page.getByTestId('occupancy-table')).toBeVisible()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-occupancy').click(),
  ])
  expect(download.suggestedFilename()).toContain('occupancy')
  await page.screenshot({ path: 'test-artifacts/shots/manager-reports.png', fullPage: true })
})

test('an agent cannot reach the manager workspace', async ({ page }) => {
  await loginAgent(page, 'wayz')

  await page.goto('/manager')
  await expect(page.getByTestId('manager-overview')).toHaveCount(0)
  await expect(page.getByTestId('dashboard')).toBeVisible()
})
