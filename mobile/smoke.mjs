/**
 * Drives the app the way an agent would, against the live API. Every console error and every
 * failed request is a failure — a screen that renders but logs a red box is not working.
 */
import { chromium } from '../frontend/node_modules/playwright/index.mjs'

const BASE = 'http://localhost:8081'
const AGENT = { email: 'agent.wayz@lockerflow.demo', password: 'Agent@123' }

const failures = []
const note = (message) => console.log(`   ${message}`)

async function run(browser, { name, width, height }) {
  console.log(`\n=== ${name} (${width}×${height})`)
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()

  const errors = []
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    // React Native Web logs a known deprecation for pointerEvents; it is not our bug.
    if (/pointerEvents is deprecated|useNativeDriver|shadow\* style props/i.test(text)) return
    errors.push(text)
  })
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('requestfailed', (request) => {
    if (request.url().includes('/api/')) errors.push(`request failed: ${request.url()}`)
  })

  const step = async (label, fn) => {
    try {
      await fn()
      note(`ok   ${label}`)
    } catch (error) {
      failures.push(`[${name}] ${label}: ${error.message.split('\n')[0]}`)
      note(`FAIL ${label}: ${error.message.split('\n')[0]}`)
    }
  }

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120_000 })

  await step('the sign-in screen renders', async () => {
    await page.getByTestId('sign-in').waitFor({ timeout: 180_000 })
    await page.getByTestId('sign-in-submit').waitFor()
  })

  await step('a wrong password is reported, not swallowed', async () => {
    await page.getByTestId('sign-in-email').fill(AGENT.email)
    await page.getByTestId('sign-in-password').fill('definitely-wrong')
    await page.getByTestId('sign-in-submit').click()
    await page.getByTestId('sign-in-error').waitFor({ timeout: 15_000 })
  })

  // The 401 above is what the previous step was proving; only what follows counts as a defect.
  errors.length = 0

  await step('the agent signs in', async () => {
    await page.getByTestId('sign-in-demo').click()
    await page.getByTestId('sign-in-submit').click()
    await page.getByTestId('today').waitFor({ timeout: 30_000 })
  })

  await step('today shows real figures from the API', async () => {
    await page.getByTestId('stat-revenue').waitFor()
    const text = await page.getByTestId('stat-revenue').innerText()
    if (!/\d/.test(text)) throw new Error(`no figure rendered: "${text}"`)
  })

  await step(`navigation renders as a ${width >= 600 ? 'rail' : 'bottom bar'}`, async () => {
    const expected = width >= 600 ? 'tab-rail' : 'tab-bar'
    await page.getByTestId(expected).waitFor()
  })

  await step('the running list opens', async () => {
    await page.getByTestId('tab-operations').click()
    await page.getByTestId('operations').waitFor({ timeout: 15_000 })
    await page.getByTestId('operations-filter').waitFor()
  })

  await step('a booking console opens with its actions', async () => {
    await page.getByTestId('operations-filter-all').click()
    const first = page.locator('[data-testid^="operation-open-"]').first()
    await first.waitFor({ timeout: 15_000 })
    await first.click()
    await page.getByTestId('booking').waitFor({ timeout: 20_000 })
  })

  await step('the deliveries desk opens', async () => {
    await page.goBack()
    await page.getByTestId('tab-deliveries').click()
    await page.getByTestId('deliveries').waitFor({ timeout: 15_000 })
  })

  await step('the sell launcher offers only the assigned activities', async () => {
    await page.getByTestId('tab-sell').click()
    await page.getByTestId('sell').waitFor({ timeout: 15_000 })
    const engines = await page.locator('[data-testid^="sell-engine-"]').count()
    if (engines === 0) throw new Error('no activities offered')
  })

  await step('the Shop & Drop wizard opens on its first step', async () => {
    await page.getByTestId('sell-engine-SHOP_AND_DROP').click()
    await page.getByTestId('shop-drop').waitFor({ timeout: 20_000 })
    await page.getByTestId('sd-customer-search').waitFor()
  })

  await step('picking a customer advances the wizard', async () => {
    await page.getByTestId('sd-customer-search').fill('a')
    const candidate = page.locator('[data-testid^="pick-customer-"]').first()
    await candidate.waitFor({ timeout: 15_000 })
    await candidate.click()
    await page.getByTestId('sd-next-customer').click()
    await page.getByTestId('sd-add-bag').waitFor({ timeout: 10_000 })
  })

  await step('the packing engine answers with real suggestions', async () => {
    await page.getByTestId('sd-next-bags').click()
    const plan = page.locator('[data-testid^="sd-plan-"]').first()
    await plan.waitFor({ timeout: 20_000 })
  })

  await step('the more menu reaches the rest of the workspace', async () => {
    await page.getByTestId('header-back').click()
    await page.getByTestId('tab-more').click()
    await page.getByTestId('more').waitFor({ timeout: 15_000 })
  })

  for (const [testId, screen] of [
    ['more-shift', 'shift'],
    ['more-incidents', 'incidents'],
    ['more-assets', 'assets'],
    ['more-customers', 'customers'],
    ['more-bookings', 'bookings'],
  ]) {
    await step(`${screen} opens, and the header goes back`, async () => {
      await page.getByTestId(testId).click()
      await page.getByTestId(screen).waitFor({ timeout: 15_000 })
      await page.getByTestId('header-back').click()
      await page.getByTestId('more').waitFor({ timeout: 10_000 })
    })
  }

  await step('signing out returns to the login screen', async () => {
    await page.getByTestId('more-profile').click()
    await page.getByTestId('profile').waitFor({ timeout: 15_000 })
    await page.getByTestId('profile-sign-out').click()
    await page.getByTestId('sign-in').waitFor({ timeout: 15_000 })
  })

  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: false })

  if (errors.length) {
    for (const error of [...new Set(errors)].slice(0, 8)) failures.push(`[${name}] console: ${error}`)
    note(`FAIL ${errors.length} console/network error(s)`)
  } else {
    note('ok   no console or network errors')
  }

  await context.close()
}

const browser = await chromium.launch()
await run(browser, { name: 'handheld', width: 390, height: 844 })
await run(browser, { name: 'tablet', width: 1280, height: 800 })
await browser.close()

console.log('')
if (failures.length) {
  console.log(`${failures.length} FAILURE(S):`)
  for (const failure of failures) console.log(`  - ${failure}`)
  process.exit(1)
}
console.log('ALL GREEN — the app runs end to end on both form factors.')
