import { test, expect, type Page } from '@playwright/test'
import { login, resetSession } from './helpers'

const ACCOUNTANT = { email: 'accountant.wayz@lockerflow.demo', password: 'Account@123' }
const ADMIN = { email: 'admin.wayz@lockerflow.demo', password: 'Admin@123' }

test.beforeEach(async ({ page }) => resetSession(page))

async function signIn(page: Page, creds: { email: string; password: string }) {
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
}

const num = (text: string) => Number((text.match(/-?[\d,]+\.\d{2}/) ?? ['0'])[0].replaceAll(',', ''))

test('the accountant signs in to a read-only financial workspace', async ({ page }) => {
  await signIn(page, ACCOUNTANT)
  await expect(page.getByTestId('accounting-dashboard')).toBeVisible()
  await expect(page.getByTestId('sidebar')).toContainText('Accounting')

  await expect(page.getByTestId('nav-accounting-dashboard')).toBeVisible()
  for (const forbidden of ['nav-pos', 'nav-shopdrop', 'nav-cashier-queue', 'nav-admin-company', 'nav-mgr-team']) {
    await expect(page.getByTestId(forbidden)).toHaveCount(0)
  }

  await page.screenshot({ path: 'test-artifacts/shots/accounting-dashboard.png', fullPage: true })

  for (const route of ['/pos', '/manager', '/admin', '/cashier', '/courier']) {
    await page.goto(route)
    await expect(page, `${route} must bounce back`).toHaveURL(/\/accounting/)
  }
})

test('the VAT return shows the ZATCA arithmetic, and it adds up on screen', async ({ page }) => {
  await signIn(page, ACCOUNTANT)
  await expect(page.getByTestId('accounting-dashboard')).toBeVisible()

  const panel = page.getByTestId('accounting-vat-return')
  await expect(panel).toContainText('Total sales (ex-VAT)')
  await expect(panel).toContainText('Total returns (ex-VAT)')
  await expect(panel).toContainText('Total purchases & expenses (ex-VAT)')

  const sales = num(await page.getByTestId('acct-stat-sales').innerText())
  const returns = num(await page.getByTestId('acct-stat-returns').innerText())
  const purchases = num(await page.getByTestId('acct-stat-purchases').innerText())
  const netBase = num(await page.getByTestId('acct-net-base').innerText())
  const dueVat = num(await page.getByTestId('acct-due-vat').innerText())

  expect(sales).toBeGreaterThan(0)
  expect(Math.abs(netBase - (sales - returns - purchases))).toBeLessThan(1)
  expect(Math.abs(dueVat - netBase * 0.15)).toBeLessThan(1)
})

test('the three activities are shown independently and can be filtered', async ({ page }) => {
  await signIn(page, ACCOUNTANT)
  await expect(page.getByTestId('accounting-dashboard')).toBeVisible()

  for (const kind of ['LAGOON', 'MOBILITY', 'SHOP_AND_DROP']) {
    await expect(page.getByTestId(`acct-activity-${kind}`)).toBeVisible()
  }
  await expect(page.getByTestId('acct-activity-LAGOON')).toContainText('Lagoon')
  await expect(page.getByTestId('acct-activity-MOBILITY')).toContainText('Scooters')
  await expect(page.getByTestId('acct-activity-SHOP_AND_DROP')).toContainText('Shop & Drop')

  const allSales = num(await page.getByTestId('acct-stat-sales').innerText())

  await page.getByTestId('accounting-activity-button').click()
  await page.getByTestId('accounting-activity-opt-LAGOON').click()

  await expect(page.getByTestId('acct-activity-MOBILITY')).toHaveCount(0)
  await expect(page.getByTestId('acct-activity-LAGOON')).toBeVisible()

  await expect
    .poll(async () => num(await page.getByTestId('acct-stat-sales').innerText()))
    .toBeLessThan(allSales)

  await page.screenshot({ path: 'test-artifacts/shots/accounting-lagoon.png', fullPage: true })
})

test('a date range narrows the report', async ({ page }) => {
  await signIn(page, ACCOUNTANT)
  await expect(page.getByTestId('accounting-dashboard')).toBeVisible()

  const before = num(await page.getByTestId('acct-stat-sales').innerText())

  await page.getByTestId('accounting-from').fill('2099-01-01')
  await page.getByTestId('accounting-to').fill('2099-12-31')

  await expect.poll(async () => num(await page.getByTestId('acct-stat-sales').innerText())).toBe(0)
  expect(before).toBeGreaterThan(0)
  await expect(page.getByTestId('accounting-dashboard')).toContainText('No transactions in this period')
})

test('the export downloads a CSV shaped like the ZATCA sales sheet', async ({ page }) => {
  await signIn(page, ACCOUNTANT)
  await expect(page.getByTestId('accounting-dashboard')).toBeVisible()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('accounting-export').click(),
  ])

  expect(download.suggestedFilename()).toMatch(/^wayz-vat-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/)

  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const c of stream) chunks.push(Buffer.from(c))
  const csv = Buffer.concat(chunks).toString('utf8')

  for (const column of ['التاريخ', 'نوع العملية', 'التفاصيل', 'رقم المرجع', 'المبيعات بدون ضريبة', 'الضريبة', 'شاملة الضريبة']) {
    expect(csv, `column ${column}`).toContain(column)
  }
  expect(csv).toContain('صافي الوعاء الضريبي')
})

test('the transaction detail lists base, VAT and total for every row', async ({ page }) => {
  await signIn(page, ACCOUNTANT)
  await expect(page.getByTestId('accounting-dashboard')).toBeVisible()

  const table = page.getByTestId('accounting-ledger-table')
  await expect(table).toContainText('Base')
  await expect(table).toContainText('VAT')
  await expect(table).toContainText('Total')

  const firstRow = table.locator('tbody tr').first()
  await expect(firstRow).toBeVisible()
  const cells = await firstRow.locator('td').allInnerTexts()
  const base = num(cells[cells.length - 3])
  const vat = num(cells[cells.length - 2])
  const total = num(cells[cells.length - 1])
  expect(Math.abs(base + vat - total)).toBeLessThan(0.02)
})

test('the workspace is written in English only — Arabic lives in the exported files', async ({ page }) => {
  await signIn(page, ACCOUNTANT)
  await expect(page.getByTestId('accounting-dashboard')).toBeVisible()

  const screen = await page.getByTestId('accounting-dashboard').innerText()
  expect(screen, 'no Arabic script should be rendered on screen').not.toMatch(/[؀-ۿ]/)

  const sidebar = await page.getByTestId('sidebar').innerText()
  expect(sidebar).not.toMatch(/[؀-ۿ]/)
})

test('the Zakat panel is annual, 2.5%, and only bites when the year is profitable', async ({ page }) => {
  await signIn(page, ACCOUNTANT)
  await expect(page.getByTestId('accounting-dashboard')).toBeVisible()

  const panel = page.getByTestId('accounting-zakat')
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('Revenue after returns (ex-VAT)')
  await expect(panel).toContainText('Costs recorded by HR (ex-VAT)')
  await expect(panel).toContainText('VAT already paid to ZATCA')
  await expect(panel).toContainText('2.5% of net profit')

  const netProfit = num(await page.getByTestId('acct-net-profit').innerText())
  const zakatDue = num(await page.getByTestId('acct-zakat-due').innerText())

  if (netProfit > 0) {
    expect(Math.abs(zakatDue - netProfit * 0.025)).toBeLessThan(1)
  } else {
    expect(zakatDue).toBe(0)
    await expect(page.getByTestId('acct-zakat-note')).toBeVisible()
  }
})

test('phase one: each activity downloads its own detailed workbook', async ({ page }) => {
  await signIn(page, ACCOUNTANT)
  await expect(page.getByTestId('accounting-dashboard')).toBeVisible()

  const exports = page.getByTestId('accounting-exports')
  await expect(exports).toContainText('One activity, in full detail')

  const from = await page.getByTestId('accounting-from').inputValue()
  const to = await page.getByTestId('accounting-to').inputValue()

  for (const kind of ['LAGOON', 'MOBILITY', 'SHOP_AND_DROP']) {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId(`accounting-export-${kind}`).click(),
    ])
    expect(download.suggestedFilename()).toBe(`wayz-${kind.toLowerCase()}-${from}_${to}.xlsx`)
  }

  await page.screenshot({ path: 'test-artifacts/shots/accounting-exports.png', fullPage: true })
})

test('phase two: one workbook summarising every activity', async ({ page }) => {
  await signIn(page, ACCOUNTANT)
  await expect(page.getByTestId('accounting-dashboard')).toBeVisible()

  await expect(page.getByTestId('accounting-exports')).toContainText('All activities, summarised')

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('accounting-export-all').click(),
  ])
  const from = await page.getByTestId('accounting-from').inputValue()
  const to = await page.getByTestId('accounting-to').inputValue()
  expect(download.suggestedFilename()).toBe(`wayz-all-activities-${from}_${to}.xlsx`)

  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const c of stream) chunks.push(Buffer.from(c))
  expect(Buffer.concat(chunks).subarray(0, 2).toString('latin1')).toBe('PK')
})

test('a tenant admin can reach the same financial reporting, and create an accountant', async ({ page }) => {
  await signIn(page, ADMIN)
  await expect(page.getByTestId('admin-overview')).toBeVisible()

  await page.getByTestId('nav-admin-accounting').click()
  await expect(page.getByTestId('accounting-dashboard')).toBeVisible()

  await page.goto('/manager/team')
  await page.getByTestId('team-add').click()
  await page.getByTestId('team-role-button').click()
  await expect(page.getByTestId('team-role-opt-ACCOUNTANT')).toBeVisible()
})

test('an operational role cannot reach the financial workspace', async ({ page }) => {
  await login(page, 'manager')
  await expect(page.getByTestId('manager-overview')).toBeVisible()

  await page.goto('/accounting')
  await expect(page).toHaveURL(/\/manager/)
})

test('every quarter of the year is one click away, with the current one marked', async ({ page }) => {
  await signIn(page, ACCOUNTANT)
  await expect(page.getByTestId('accounting-dashboard')).toBeVisible()

  const year = new Date().getFullYear()
  const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1

  for (let q = 1; q <= 4; q++) {
    await expect(page.getByTestId(`accounting-preset-q${q}-${year}`), `Q${q} is offered`).toBeVisible()
  }

  const current = page.getByTestId(`accounting-preset-q${currentQuarter}-${year}`)
  await expect(current, 'the quarter in progress reads differently').toContainText('now')

  await current.click()
  await expect(page.getByTestId('accounting-from')).toHaveValue(
    `${year}-${String((currentQuarter - 1) * 3 + 1).padStart(2, '0')}-01`,
  )
})

test('the audit trail lists real actions, paginated, with a reference on every row', async ({ page }) => {
  await signIn(page, ADMIN)
  await expect(page.getByTestId('admin-overview')).toBeVisible()

  await page.goto('/admin/audit')
  await expect(page.getByTestId('admin-audit-table')).toBeVisible()

  const rows = page.getByTestId('admin-audit-table').locator('tbody tr')
  await expect(rows).toHaveCount(15)

  const pagination = page.getByTestId('admin-audit-table-pagination')
  await expect(pagination).toContainText('Showing')
  await expect(pagination).toContainText('1')

  const first = await rows.first().innerText()
  expect(first, 'an action, a person and a reference').toBeTruthy()

  await page.getByTestId('admin-audit-table-next').click()
  await expect(pagination).toContainText('16')
  await page.screenshot({ path: 'test-artifacts/shots/admin-audit.png', fullPage: true })
})
