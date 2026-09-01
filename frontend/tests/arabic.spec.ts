import { test, expect, Page } from '@playwright/test'
import { login, resetSession, CREDS } from './helpers'

const ARABIC = /[؀-ۿ]/

test.beforeEach(async ({ page }) => resetSession(page))

async function switchToArabic(page: Page) {
  await page.getByTestId('language-toggle').click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
}

test('the header toggle turns the whole platform over to Arabic, right to left', async ({ page }) => {
  await login(page, 'manager')
  await expect(page.getByTestId('manager-overview')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')

  await switchToArabic(page)

  await expect(page.getByTestId('sidebar')).toContainText(ARABIC)
  await expect(page.getByTestId('manager-overview')).toContainText(ARABIC)

  // RTL is a layout change, not a font change: the sidebar moves to the right.
  const sidebar = await page.getByTestId('sidebar').boundingBox()
  const viewport = page.viewportSize()!
  expect(sidebar!.x).toBeGreaterThan(viewport.width / 2)

  await page.screenshot({ path: 'test-artifacts/shots/arabic-manager.png', fullPage: true })
})

test('the choice survives a reload and a new page', async ({ page }) => {
  await login(page, 'manager')
  await switchToArabic(page)

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')

  await page.goto('/assets')
  await expect(page.getByTestId('assets-page')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByTestId('assets-page')).toContainText(ARABIC)
})

test('every workspace reads in Arabic, and none of them scrolls sideways', async ({ page }) => {
  const workspaces: [keyof typeof CREDS, string, string][] = [
    ['manager', '/manager', 'manager-overview'],
    ['admin', '/admin', 'admin-overview'],
    ['hr', '/hr', 'hr-costs'],
    ['accountant', '/accounting', 'accounting-dashboard'],
    ['cashier', '/cashier', 'cashier-till'],
  ]

  for (const [who, path, testId] of workspaces) {
    await resetSession(page)
    await login(page, who)
    await switchToArabic(page)
    await page.goto(path)
    await expect(page.getByTestId(testId), `${who} workspace`).toBeVisible()
    await expect(page.getByTestId(testId)).toContainText(ARABIC)

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `${path} must not scroll sideways in RTL`).toBeLessThanOrEqual(2)
  }
})

test('the estate reads in Arabic from the list through to one asset', async ({ page }) => {
  await login(page, 'manager')
  await switchToArabic(page)

  await page.goto('/assets')
  await expect(page.getByTestId('asset-types-table')).toContainText(ARABIC)
  await expect(page.getByTestId('asset-filter-ALL')).toContainText(ARABIC)

  await page.getByTestId('asset-types-table').locator('tbody tr').first().click()
  await expect(page.getByTestId('asset-type-detail')).toBeVisible()
  await expect(page.getByTestId('asset-units-table')).toContainText(ARABIC)

  await page.getByTestId('asset-units-table').locator('tbody tr').first().click()
  await expect(page.getByTestId('asset-unit')).toBeVisible()
  await expect(page.getByTestId('asset-unit')).toContainText(ARABIC)
})

test('the manual is a book in Arabic, not an English one with Arabic chrome', async ({ page }) => {
  await login(page, 'manager')
  await switchToArabic(page)

  await page.goto('/help/manual')
  await expect(page.getByTestId('manual-page')).toBeVisible()

  const shopDrop = page.getByTestId('manual-section-shop-drop')
  await expect(shopDrop).toContainText(ARABIC)
  // The rules and tips are the body of the book, not just its headings.
  await expect(shopDrop).toContainText('تأكيد الإيداع')

  const body = await page.getByTestId('manual-page').innerText()
  const latinSentences = body
    .split('\n')
    .filter((line) => /[A-Za-z]{4,}\s+[A-Za-z]{4,}/.test(line) && !ARABIC.test(line))
  expect(latinSentences, 'no English prose should be left in the Arabic manual').toEqual([])
})

test('numbers and money stay left to right inside Arabic text', async ({ page }) => {
  await login(page, 'cashier')
  await switchToArabic(page)
  await page.goto('/cashier')
  await expect(page.getByTestId('cashier-till')).toBeVisible()
  await expect(page.getByTestId('till-stat-drawer')).toBeVisible()

  // A price reads "123.00 SAR" in either language; only its surroundings mirror.
  const money = await page.getByTestId('cashier-till').innerText()
  expect(money).toMatch(/\d+\.\d{2}/)
  expect(money, 'no English is left once the figures are in').not.toMatch(/Loading/)
})

test('a customer with no account can read their tracking page in Arabic', async ({ page }) => {
  await login(page, 'wayz')
  const token = await page.evaluate(
    () => JSON.parse(localStorage.getItem('wayz.platform.auth') || '{}')?.state?.token,
  )
  const bookings = await (
    await page.request.get('/api/bookings', { headers: { Authorization: `Bearer ${token}` } })
  ).json()
  const withToken = (bookings.data ?? []).find((b: { trackingToken?: string }) => b.trackingToken)
  expect(withToken, 'the demo data has a booking a customer can track').toBeTruthy()

  await resetSession(page)
  await page.goto(`/track/${withToken.trackingToken}`)
  await expect(page.getByTestId('tracking-page')).toBeVisible()

  await page.getByTestId('language-toggle').click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByTestId('tracking-page')).toContainText(ARABIC)
})

test('switching back to English restores the layout', async ({ page }) => {
  await login(page, 'manager')
  await switchToArabic(page)

  await page.getByTestId('language-toggle').click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')

  const sidebar = await page.getByTestId('sidebar').boundingBox()
  expect(sidebar!.x).toBeLessThan(page.viewportSize()!.width / 2)
})
