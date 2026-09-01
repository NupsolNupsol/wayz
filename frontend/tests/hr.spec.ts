import { test, expect, type Page } from '@playwright/test'
import { login, resetSession } from './helpers'

const HR = { email: 'hr.wayz@lockerflow.demo', password: 'People@123' }
const ADMIN = { email: 'admin.wayz@lockerflow.demo', password: 'Admin@123' }
const ACCOUNTANT = { email: 'accountant.wayz@lockerflow.demo', password: 'Account@123' }

test.beforeEach(async ({ page }) => resetSession(page))

async function signIn(page: Page, creds: { email: string; password: string }, landing = 'hr-costs') {
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

  await expect(page.getByTestId(landing)).toBeVisible()
}

const num = (text: string) => Number((text.match(/-?[\d,]+(\.\d{2})?/) ?? ['0'])[0].replaceAll(',', ''))

const unique = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`

test('HR appears on the sign-in screen and lands on its own workspace', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByTestId('demo-hr.wayz@lockerflow.demo')).toBeVisible()

  await page.getByTestId('demo-hr.wayz@lockerflow.demo').click()
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

  await expect(page.getByTestId('hr-costs')).toBeVisible()
  await expect(page).toHaveURL(/\/hr/)
  await expect(page.getByTestId('sidebar')).toContainText('HR & costs')

  await expect(page.getByTestId('nav-hr-overview')).toBeVisible()
  await expect(page.getByTestId('nav-hr-seasons')).toBeVisible()
  for (const forbidden of ['nav-pos', 'nav-cashier-queue', 'nav-admin-company', 'nav-mgr-team', 'nav-accounting-dashboard']) {
    await expect(page.getByTestId(forbidden)).toHaveCount(0)
  }

  await page.screenshot({ path: 'test-artifacts/shots/hr-costs.png', fullPage: true })
})

test('HR is fenced out of every other workspace', async ({ page }) => {
  await signIn(page, HR)
  await expect(page.getByTestId('hr-costs')).toBeVisible()

  for (const route of ['/pos', '/manager', '/admin', '/cashier', '/courier', '/accounting']) {
    await page.goto(route)
    await expect(page, `${route} must bounce back`).toHaveURL(/\/hr/)
  }
})

test('the costs page opens with the season totals already in place', async ({ page }) => {
  await signIn(page, HR)
  await expect(page.getByTestId('hr-costs')).toBeVisible()

  const count = num(await page.getByTestId('hr-stat-count').innerText())
  const base = num(await page.getByTestId('hr-stat-base').innerText())
  expect(count).toBeGreaterThan(0)
  expect(base).toBeGreaterThan(0)

  const categories = page.getByTestId('hr-by-category')
  for (const label of ['Payroll', 'Venue rent', 'Repair']) {
    await expect(categories).toContainText(label)
  }

  const table = page.getByTestId('hr-costs-table')
  await expect(table.locator('tbody tr').first()).toBeVisible()
})

test('HR records a supplier cost and it lands in the table with its VAT split', async ({ page }) => {
  await signIn(page, HR)
  await expect(page.getByTestId('hr-costs')).toBeVisible()

  const before = num(await page.getByTestId('hr-stat-count').innerText())
  const reference = `INV-${unique()}`

  await page.getByTestId('hr-add-cost').click()
  await expect(page.getByTestId('hr-cost-modal')).toBeVisible()

  await page.getByTestId('hr-cost-category-button').click()
  await page.getByTestId('hr-cost-category-opt-REPAIR').click()
  await page.getByTestId('hr-cost-amount').fill('1150')
  await page.getByTestId('hr-cost-description').fill('Boat hull repair after collision')
  await page.getByTestId('hr-cost-supplier').fill('Marine Works Co.')
  await page.getByTestId('hr-cost-reference').fill(reference)
  await page.getByTestId('hr-cost-activity-button').click()
  await page.getByTestId('hr-cost-activity-opt-LAGOON').click()

  await page.getByTestId('hr-cost-submit').click()
  await expect(page.getByTestId('hr-cost-modal')).toHaveCount(0)

  await expect.poll(async () => num(await page.getByTestId('hr-stat-count').innerText())).toBe(before + 1)

  const table = page.getByTestId('hr-costs-table')
  await page.getByTestId('filter-what').click()
  await page.getByTestId('filter-pop-what').getByRole('textbox').fill(reference)

  const row = table.locator('tbody tr').first()
  await expect(row).toContainText('Boat hull repair after collision')
  await expect(row).toContainText('Repair')
  await expect(row).toContainText('Lagoon')

  const cells = await row.locator('td').allInnerTexts()
  const base = num(cells[4])
  const vat = num(cells[5])
  const total = num(cells[6])
  expect(base).toBeCloseTo(1000, 1)
  expect(vat).toBeCloseTo(150, 1)
  expect(Math.abs(base + vat - total)).toBeLessThan(0.02)
})

test('a cost cannot be recorded without a description and an amount', async ({ page }) => {
  await signIn(page, HR)
  await expect(page.getByTestId('hr-costs')).toBeVisible()

  await page.getByTestId('hr-add-cost').click()
  await expect(page.getByTestId('hr-cost-submit')).toBeDisabled()

  await page.getByTestId('hr-cost-description').fill('Fuel for the boats')
  await expect(page.getByTestId('hr-cost-submit')).toBeDisabled()

  await page.getByTestId('hr-cost-amount').fill('500')
  await expect(page.getByTestId('hr-cost-submit')).toBeEnabled()
})

test('voiding a cost needs a reason and takes it out of the totals', async ({ page }) => {
  await signIn(page, HR)
  await expect(page.getByTestId('hr-costs')).toBeVisible()

  const reference = `INV-${unique()}`
  await page.getByTestId('hr-add-cost').click()
  await page.getByTestId('hr-cost-amount').fill('9200')
  await page.getByTestId('hr-cost-description').fill('Entered twice by mistake')
  await page.getByTestId('hr-cost-reference').fill(reference)
  await page.getByTestId('hr-cost-submit').click()
  await expect(page.getByTestId('hr-cost-modal')).toHaveCount(0)

  const withCost = num(await page.getByTestId('hr-stat-base').innerText())

  const table = page.getByTestId('hr-costs-table')
  await page.getByTestId('filter-what').click()
  await page.getByTestId('filter-pop-what').getByRole('textbox').fill(reference)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('filter-pop-what')).toHaveCount(0)
  const row = table.locator('tbody tr').first()
  await expect(row).toContainText('Entered twice by mistake')

  await row.getByRole('button', { name: 'Void' }).click()
  await expect(page.getByTestId('hr-void-modal')).toBeVisible()
  await expect(page.getByTestId('hr-void-submit')).toBeDisabled()

  await page.getByTestId('hr-void-reason').fill('Duplicate of the earlier invoice')
  await page.getByTestId('hr-void-submit').click()
  await expect(page.getByTestId('hr-void-modal')).toHaveCount(0)

  await expect.poll(async () => num(await page.getByTestId('hr-stat-base').innerText())).toBeLessThan(withCost)
  await expect(row).toContainText('VOID')
})

test('a cost HR records shows up in the accountant\'s VAT position', async ({ page }) => {
  await signIn(page, ACCOUNTANT, 'accounting-dashboard')
  await expect(page.getByTestId('accounting-dashboard')).toBeVisible()
  const before = num(await page.getByTestId('acct-stat-purchases').innerText())

  await resetSession(page)
  await signIn(page, HR)
  await expect(page.getByTestId('hr-costs')).toBeVisible()

  await page.getByTestId('hr-add-cost').click()
  await page.getByTestId('hr-cost-amount').fill('34500')
  await page.getByTestId('hr-cost-description').fill('Accommodation rent for the crew')
  await page.getByTestId('hr-cost-category-button').click()
  await page.getByTestId('hr-cost-category-opt-RENT_ACCOMMODATION').click()
  await page.getByTestId('hr-cost-submit').click()
  await expect(page.getByTestId('hr-cost-modal')).toHaveCount(0)

  await resetSession(page)
  await signIn(page, ACCOUNTANT, 'accounting-dashboard')
  await expect(page.getByTestId('accounting-dashboard')).toBeVisible()

  await expect
    .poll(async () => num(await page.getByTestId('acct-stat-purchases').innerText()))
    .toBeGreaterThan(before)

  const table = page.getByTestId('accounting-ledger-table')
  await page.getByTestId('filter-details').click()
  await page.getByTestId('filter-pop-details').getByRole('textbox').fill('Accommodation rent for the crew')
  await expect(table.locator('tbody tr').first()).toContainText('Expense')
})

test('a season opens into its own page showing who is charged and what it cost', async ({ page }) => {
  await signIn(page, HR)
  await page.getByTestId('nav-hr-seasons').click()
  await expect(page.getByTestId('hr-seasons')).toBeVisible()

  const seeded = page.getByTestId('hr-season-ssn-0001')
  await expect(seeded).toContainText('Riyadh Season 2026')
  await expect(seeded).toContainText('Employee charges')

  await seeded.click()
  await expect(page).toHaveURL(/\/hr\/seasons\/ssn-0001/)
  await expect(page.getByTestId('season-detail')).toBeVisible()

  await expect(page.getByTestId('season-stat-employees')).toContainText('of')
  expect(num(await page.getByTestId('season-stat-payroll').innerText())).toBeGreaterThan(0)
  expect(num(await page.getByTestId('season-stat-base').innerText())).toBeGreaterThan(0)

  const employees = page.getByTestId('season-employees-table')
  await expect(employees.locator('tbody tr').first()).toBeVisible()
  await expect(employees).toContainText('Agent')

  const costs = page.getByTestId('season-costs-table')
  await expect(costs.locator('tbody tr').first()).toBeVisible()
  await expect(costs).not.toContainText('Payroll')

  await expect(page.getByTestId('season-charge')).toContainText('Everyone charged')
  await expect(page.getByTestId('season-charge')).toBeDisabled()
  await expect(page.getByTestId('season-warning')).toHaveCount(0)

  await page.screenshot({ path: 'test-artifacts/shots/hr-season-detail.png', fullPage: true })

  await page.getByRole('link', { name: 'Seasons' }).first().click()
  await expect(page.getByTestId('hr-seasons'), 'the breadcrumb is the way back').toBeVisible()
})

test('a new season is flagged as uncharged, and charging it says exactly who was charged', async ({ page }) => {
  await signIn(page, HR)
  await page.goto('/hr/seasons')
  await expect(page.getByTestId('hr-seasons')).toBeVisible()

  const name = `Test Season ${unique()}`
  await page.getByTestId('hr-add-season').click()
  await expect(page.getByTestId('hr-season-modal')).toBeVisible()
  await page.getByTestId('hr-season-name').fill(name)

  const start = await page.getByTestId('hr-season-start').inputValue()
  const end = await page.getByTestId('hr-season-end').inputValue()
  const months = (new Date(end).getFullYear() - new Date(start).getFullYear()) * 12 + (new Date(end).getMonth() - new Date(start).getMonth())
  expect(months, 'a season defaults to six months').toBe(6)

  await page.getByTestId('hr-season-submit').click()

  await expect(page.getByTestId('season-detail'), 'creating a season opens it').toBeVisible()
  await expect(page.getByTestId('season-detail')).toContainText(name)
  await expect(page.getByTestId('season-warning')).toBeVisible()
  await expect(page.getByTestId('season-stat-employees')).toContainText('0 of')

  const charge = page.getByTestId('season-charge')
  await expect(charge).toContainText('Charge')
  await charge.click()

  const modal = page.getByTestId('hr-payroll-modal')
  await expect(modal).toBeVisible()
  await expect(page.getByTestId('payroll-pending')).toContainText('will be charged')
  await expect(page.getByTestId('payroll-already')).toHaveCount(0)
  await expect(page.getByTestId('hr-payroll-AGENT')).toHaveValue('5500')

  const total = num(await page.getByTestId('payroll-total').innerText())
  expect(total).toBeGreaterThan(0)

  await expect(page.getByTestId('hr-payroll-submit')).toContainText('Charge')
  await page.getByTestId('hr-payroll-submit').click()
  await expect(modal).toHaveCount(0)

  await expect(page.getByTestId('season-warning')).toHaveCount(0)
  await expect(page.getByTestId('season-charge')).toContainText('Everyone charged')
  await expect(page.getByTestId('season-charge')).toBeDisabled()

  await expect.poll(async () => num(await page.getByTestId('season-stat-payroll').innerText())).toBe(total)

  // A suspended account is not chargeable, so it stays listed as uncharged. Everyone still on
  // the payroll must be charged.
  const employees = page.getByTestId('season-employees-table')
  const uncharged = employees.locator('tbody tr').filter({ hasText: 'not charged' })
  const suspended = employees.locator('tbody tr').filter({ hasText: 'suspended' })
  expect(await uncharged.count()).toBe(await suspended.count())
})

test('charging a season twice never doubles it, and the dialog says so before you try', async ({ page }) => {
  await signIn(page, HR)
  await page.goto('/hr/seasons/ssn-0001')
  await expect(page.getByTestId('season-detail')).toBeVisible()

  const payroll = num(await page.getByTestId('season-stat-payroll').innerText())
  const employees = await page.getByTestId('season-stat-employees').innerText()

  await expect(page.getByTestId('season-charge'), 'nothing to charge, so the action is closed').toBeDisabled()

  await page.goto('/hr/seasons')
  const card = page.getByTestId('hr-season-ssn-0001')
  await expect(card).not.toContainText('No employee charges yet')

  await page.goto('/hr/seasons/ssn-0001')
  await expect(page.getByTestId('season-detail')).toBeVisible()
  expect(num(await page.getByTestId('season-stat-payroll').innerText())).toBe(payroll)
  expect(await page.getByTestId('season-stat-employees').innerText()).toBe(employees)
})

test('the HR workspace is written in English only', async ({ page }) => {
  await signIn(page, HR)
  await expect(page.getByTestId('hr-costs')).toBeVisible()

  const costs = await page.getByTestId('hr-costs').innerText()
  expect(costs, 'no Arabic script should be rendered on screen').not.toMatch(/[؀-ۿ]/)

  await page.getByTestId('nav-hr-seasons').click()
  await expect(page.getByTestId('hr-seasons')).toBeVisible()
  const seasons = await page.getByTestId('hr-seasons').innerText()
  expect(seasons).not.toMatch(/[؀-ۿ]/)

  await page.goto('/hr/seasons/ssn-0001')
  await expect(page.getByTestId('season-detail')).toBeVisible()
  expect(await page.getByTestId('season-detail').innerText()).not.toMatch(/[؀-ۿ]/)
})

test('a tenant admin sees the HR desk, and can create the HR account', async ({ page }) => {
  await signIn(page, ADMIN, 'admin-overview')
  await expect(page.getByTestId('admin-overview')).toBeVisible()

  await page.getByTestId('nav-admin-costs').click()
  await expect(page.getByTestId('hr-costs')).toBeVisible()

  await page.goto('/manager/team')
  await page.getByTestId('team-add').click()
  await page.getByTestId('team-role-button').click()
  await expect(page.getByTestId('team-role-opt-HR')).toBeVisible()
})

test('a manager can neither open the HR desk nor hand out the HR role', async ({ page }) => {
  await login(page, 'manager')
  await expect(page.getByTestId('manager-overview')).toBeVisible()

  await page.goto('/hr')
  await expect(page).toHaveURL(/\/manager/)

  await page.goto('/manager/team')
  await page.getByTestId('team-add').click()
  await page.getByTestId('team-role-button').click()
  await expect(page.getByTestId('team-role-opt-HR')).toHaveCount(0)
  await expect(page.getByTestId('team-role-opt-AGENT')).toBeVisible()
})

test('every column in All costs can be sorted and filtered', async ({ page }) => {
  await signIn(page, HR)
  await expect(page.getByTestId('hr-costs')).toBeVisible()

  const table = page.getByTestId('hr-costs-table')
  const all = num(await page.getByTestId('hr-stat-count').innerText())
  expect(all).toBeGreaterThan(0)

  for (const key of ['what', 'category', 'activity', 'season']) {
    await expect(page.getByTestId(`filter-${key}`), `${key} must be filterable`).toBeVisible()
  }
  for (const key of ['what', 'activity', 'season', 'base', 'total', 'when']) {
    await expect(page.getByTestId(`sort-${key}`), `${key} must be sortable`).toBeVisible()
  }

  await page.getByTestId('filter-activity').click()
  await page.getByTestId('filter-pop-activity').getByText('Lagoon', { exact: true }).click()
  await page.keyboard.press('Escape')
  const rows = table.locator('tbody tr')
  await expect(rows.first()).toContainText('Lagoon')
  for (const cells of await rows.evaluateAll((list) => list.map((r) => r.textContent ?? ''))) {
    expect(cells).toContain('Lagoon')
  }

  await page.getByTestId('filter-activity').click()
  await page.getByTestId('filter-pop-activity').getByText('Lagoon', { exact: true }).click()
  await page.keyboard.press('Escape')

  await page.getByTestId('filter-season').click()
  await page.getByTestId('filter-pop-season').getByText('Riyadh Season 2026 — H1', { exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(rows.first()).toBeVisible()

  await page.getByTestId('sort-season').click()
  await expect(table).toBeVisible()
})
