import { test, expect } from '@playwright/test'
import { login, loginAgent, resetSession } from './helpers'

test.beforeEach(async ({ page }) => resetSession(page))

test('the sidebar exposes both help sections and the manual renders every screen', async ({ page }) => {
  await loginAgent(page, 'wayz')

  await page.getByTestId('nav-manual').click()
  await expect(page.getByTestId('manual-page')).toBeVisible()

  for (const id of ['dashboard', 'shop-drop', 'verification', 'overtime', 'incidents', 'shift']) {
    await expect(page.getByTestId(`manual-section-${id}`)).toBeAttached()
  }

  await expect(page.getByTestId('manual-section-overtime')).toContainText('5 minutes')
  await expect(page.getByTestId('manual-section-shop-drop')).toContainText('does NOT start the timer')
  await page.screenshot({ path: 'test-artifacts/shots/help-manual.png', fullPage: true })
})

test('the contents panel stays put while reading, and tracks the current section', async ({ page }) => {
  await loginAgent(page, 'wayz')
  await page.goto('/help/manual')

  const search = page.getByTestId('manual-search')
  await expect(search).toBeVisible()
  const topBefore = (await search.boundingBox())!.y

  const scrollTo = (id: string) =>
    page.evaluate((sectionId) => document.getElementById(sectionId)?.scrollIntoView({ block: 'start' }), id)

  await scrollTo('verification')
  await page.waitForTimeout(600)

  await expect(search).toBeInViewport()
  const topAfter = (await search.boundingBox())!.y
  expect(topAfter).toBeGreaterThan(70)
  expect(Math.abs(topAfter - topBefore)).toBeLessThan(400)

  await expect(page.locator('[data-testid^="manual-toc-"][data-active="true"]')).toHaveCount(1)
  await expect(page.getByTestId('manual-toc-verification')).toHaveAttribute('data-active', 'true')

  await scrollTo('dashboard')
  await expect(page.getByTestId('manual-toc-dashboard')).toHaveAttribute('data-active', 'true')
  await expect(page.getByTestId('manual-toc-verification')).toHaveAttribute('data-active', 'false')
  await page.screenshot({ path: 'test-artifacts/shots/help-manual-sticky.png', fullPage: false })
})

test('the manual search narrows the contents', async ({ page }) => {
  await loginAgent(page, 'wayz')
  await page.goto('/help/manual')

  await page.getByTestId('manual-search').fill('grace period')
  await expect(page.getByTestId('manual-section-overtime')).toBeVisible()
  await expect(page.getByTestId('manual-section-profile')).toHaveCount(0)
})

test('every page carries a help icon that deep-links to its own manual section', async ({ page }) => {
  await loginAgent(page, 'wayz')

  const pages: [string, string][] = [
    ['/shop-drop', 'shop-drop'],
    ['/operations', 'operations'],
    ['/incidents', 'incidents'],
    ['/assets', 'assets'],
    ['/shift', 'shift'],
  ]

  for (const [route, sectionId] of pages) {
    await page.goto(route)
    const help = page.getByTestId('page-help')
    await expect(help, `${route} should offer help`).toBeVisible()
    await expect(help).toHaveAttribute('href', `/help/manual#${sectionId}`)
  }

  await page.goto('/shop-drop')
  await page.getByTestId('page-help').click()
  await expect(page.getByTestId('manual-page')).toBeVisible()
  expect(page.url()).toContain('#shop-drop')
  await expect(page.getByTestId('manual-section-shop-drop')).toBeInViewport()
})

test('the architecture page documents the engine from the LIVE workflow catalogue', async ({ page }) => {
  await loginAgent(page, 'wayz')

  await page.goto('/help/architecture')
  await expect(page.getByTestId('architecture-page')).toBeVisible()

  const catalogue = page.getByTestId('arch-catalogue')
  await expect(catalogue).toContainText('SHOP_AND_DROP')
  await expect(catalogue).toContainText('RESERVED → ACTIVE')

  for (const id of [
    'arch-layers',
    'arch-package',
    'arch-engine',
    'arch-ids',
    'arch-ports',
    'arch-domain',
    'arch-controls',
    'arch-security',
    'arch-testing',
    'arch-limits',
  ]) {
    await expect(page.getByTestId(id)).toBeAttached()
  }

  const pkg = page.getByTestId('arch-package')
  await expect(pkg).toContainText('guards')
  await expect(pkg).toContainText('effects')
  await expect(pkg).toContainText('independent package')
  await expect(pkg).toContainText('pure')

  await expect(page.getByTestId('arch-engine')).toContainText('COMPARTMENT')
  await page.screenshot({ path: 'test-artifacts/shots/help-architecture.png', fullPage: true })
})

test('a MANAGER can reach the manual and the architecture docs', async ({ page }) => {
  await login(page, 'manager')
  await expect(page.getByTestId('manager-overview')).toBeVisible()

  await page.getByTestId('nav-manual').click()
  await expect(page.getByTestId('manual-page')).toBeVisible()
  await expect(page.getByTestId('manual-section-shop-drop')).toBeAttached()

  await expect(page.getByTestId('nav-architecture'), 'only the manual is in the sidebar').toHaveCount(0)

  await page.goto('/help/architecture')
  await expect(page.getByTestId('architecture-page')).toBeVisible()
  await expect(page.getByTestId('arch-package')).toBeVisible()

  await page.goto('/pos')
  await expect(page.getByTestId('manager-overview')).toBeVisible()
  await page.screenshot({ path: 'test-artifacts/shots/manager-docs.png', fullPage: true })
})

test('the platform is branded WAYZ', async ({ page }) => {
  await loginAgent(page, 'wayz')
  await expect(page.getByTestId('sidebar')).toContainText('WAYZ')
  await expect(page).toHaveTitle(/WAYZ/)
})
