/** Captures the workspace on both form factors, for a visual review. */
import { chromium } from '../frontend/node_modules/playwright/index.mjs'

const BASE = 'http://localhost:8081'

async function capture(browser, { name, width, height }) {
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.getByTestId('sign-in').waitFor({ timeout: 180_000 })
  await page.getByTestId('sign-in-demo').click()
  await page.getByTestId('sign-in-submit').click()
  await page.getByTestId('today').waitFor({ timeout: 60_000 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `screenshots/${name}-today.png` })

  await page.getByTestId('tab-operations').click()
  await page.getByTestId('operations').waitFor()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `screenshots/${name}-operations.png` })

  const first = page.locator('[data-testid^="operation-open-"]').first()
  if (await first.count()) {
    await first.click()
    await page.getByTestId('booking').waitFor({ timeout: 30_000 })
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `screenshots/${name}-booking.png` })
    await page.getByTestId('header-back').click()
  }

  await page.getByTestId('tab-deliveries').click()
  await page.getByTestId('deliveries').waitFor()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `screenshots/${name}-deliveries.png` })

  await page.getByTestId('tab-sell').click()
  await page.getByTestId('sell').waitFor()
  await page.waitForTimeout(800)
  await page.screenshot({ path: `screenshots/${name}-sell.png` })

  await page.getByTestId('sell-engine-SHOP_AND_DROP').click()
  await page.getByTestId('shop-drop').waitFor({ timeout: 30_000 })
  await page.getByTestId('sd-customer-search').fill('a')
  const candidate = page.locator('[data-testid^="pick-customer-"]').first()
  await candidate.waitFor({ timeout: 20_000 })
  await candidate.click()
  await page.getByTestId('sd-next-customer').click()
  await page.getByTestId('sd-add-bag').waitFor({ timeout: 15_000 })
  await page.waitForTimeout(800)
  await page.screenshot({ path: `screenshots/${name}-wizard.png` })

  await context.close()
  console.log(`captured ${name}`)
}

const browser = await chromium.launch()
await capture(browser, { name: 'phone', width: 390, height: 844 })
await capture(browser, { name: 'tab', width: 1280, height: 800 })
await browser.close()
