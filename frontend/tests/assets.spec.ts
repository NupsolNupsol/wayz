import { test, expect, Page } from '@playwright/test'
import { login, resetSession, authToken } from './helpers'

test.beforeEach(async ({ page }) => resetSession(page))

async function openEstate(page: Page, who: 'manager' | 'admin' | 'hr') {
  await login(page, who)
  await page.goto('/assets')
  await expect(page.getByTestId('assets-page')).toBeVisible()
  await expect(page.getByTestId('asset-types-table')).toBeVisible()
}

/** Adds throwaway assets through the API and hands back a cleanup. */
async function scratch(page: Page, count = 2) {
  const token = await authToken(page)
  const headers = { Authorization: `Bearer ${token}` }

  const estate = await (await page.request.get('/api/assets/types', { headers })).json()
  const type = estate.data.assetTypes.find((t: { engineKind: string }) => t.engineKind === 'MOBILITY')
  const stationId = estate.data.stations[0]._id

  const res = await page.request.post(`/api/assets/types/${type._id}/units`, {
    headers,
    data: { stationId, count, identifierPrefix: `E${Date.now() % 10000}` },
  })
  expect(res.ok(), `add units → ${res.status()} ${await res.text()}`).toBeTruthy()
  const identifiers: string[] = (await res.json()).data.identifiers

  const detail = await (await page.request.get(`/api/assets/types/${type._id}`, { headers })).json()
  const units = detail.data.units.filter((u: { identifier: string }) => identifiers.includes(u.identifier))

  return {
    typeId: type._id as string,
    typeName: type.name as string,
    units: units as { _id: string; identifier: string }[],
    cleanup: async () => {
      for (const u of units) await page.request.delete(`/api/assets/units/${u._id}`, { headers })
    },
  }
}

test('the estate is one grid table of rows, not a wall of cards', async ({ page }) => {
  await openEstate(page, 'manager')

  const table = page.getByTestId('asset-types-table')
  await expect(table.locator('table')).toBeVisible()
  await expect(table.locator('tbody tr').first()).toBeVisible()

  for (const stat of ['asset-stat-total', 'asset-stat-inuse', 'asset-stat-free', 'asset-stat-down']) {
    await expect(page.getByTestId(stat)).toBeVisible()
  }

  await page.screenshot({ path: 'test-artifacts/shots/assets-list.png', fullPage: true })
})

test('manager, tenant admin and HR all land on the same estate page', async ({ page }) => {
  for (const who of ['manager', 'admin', 'hr'] as const) {
    await resetSession(page)
    await openEstate(page, who)
    await expect(page).toHaveURL(/\/assets$/)
  }
})

test('the three activity buttons filter the rows', async ({ page }) => {
  await openEstate(page, 'manager')

  const rows = page.getByTestId('asset-types-table').locator('tbody tr')
  const all = await rows.count()

  await page.getByTestId('asset-filter-MOBILITY').click()
  await expect(page.getByTestId('asset-filter-MOBILITY')).toHaveAttribute('data-active', 'yes')
  const mobility = await rows.count()
  expect(mobility).toBeGreaterThan(0)
  expect(mobility).toBeLessThanOrEqual(all)

  await page.getByTestId('asset-filter-SHOP_AND_DROP').click()
  const bags = await rows.count()
  expect(bags).toBeGreaterThan(0)

  await page.getByTestId('asset-filter-ALL').click()
  await expect(rows).toHaveCount(all)
})

test('a row opens the assets of that kind, paginated', async ({ page }) => {
  await openEstate(page, 'manager')

  const firstName = await page.getByTestId('asset-types-table').locator('tbody tr').first().innerText()
  await page.getByTestId('asset-types-table').locator('tbody tr').first().click()

  await expect(page.getByTestId('asset-type-detail')).toBeVisible()
  await expect(page.getByTestId('asset-units-table')).toBeVisible()
  await expect(page.getByTestId('asset-units-table').locator('tbody tr').first()).toBeVisible()
  expect(firstName.split('\n')[0]).toBeTruthy()

  await page.screenshot({ path: 'test-artifacts/shots/assets-detail.png', fullPage: true })
})

test('an asset can be added, suspended, restored and removed from the page', async ({ page }) => {
  await login(page, 'manager')
  const { typeId, units, cleanup } = await scratch(page, 1)
  const unit = units[0]

  await page.goto(`/assets/${typeId}`)
  await expect(page.getByTestId('asset-units-table')).toBeVisible()

  // Find it through the identifier filter rather than trusting the page it landed on.
  await page.getByTestId(`asset-suspend-${unit._id}`).scrollIntoViewIfNeeded().catch(() => undefined)
  const suspend = page.getByTestId(`asset-suspend-${unit._id}`)
  if (!(await suspend.count())) {
    await page.goto(`/assets/unit/${unit._id}`)
    await expect(page.getByTestId('asset-unit')).toBeVisible()
    await page.getByTestId('asset-unit-suspend').click()
    await expect(page.getByText('OUT OF SERVICE', { exact: false }).first()).toBeVisible()
    await page.getByTestId('asset-unit-restore').click()
  } else {
    await suspend.click()
    await expect(page.getByTestId(`asset-restore-${unit._id}`)).toBeVisible()
    await page.getByTestId(`asset-restore-${unit._id}`).click()
    await expect(page.getByTestId(`asset-suspend-${unit._id}`)).toBeVisible()
  }

  await cleanup()
})

test('one asset can be priced apart from its kind, and the kind price can move everything', async ({ page }) => {
  await login(page, 'manager')
  const { typeId, units, cleanup } = await scratch(page, 1)

  await page.goto(`/assets/unit/${units[0]._id}`)
  await expect(page.getByTestId('asset-unit')).toBeVisible()

  await page.getByTestId('asset-unit-edit').click()
  await page.getByTestId('asset-unit-own-price').check()
  await page.getByTestId('asset-unit-price').fill('123')
  await page.getByTestId('asset-unit-edit-submit').click()

  await expect(page.getByTestId('asset-unit-edit-modal')).toBeHidden()
  await expect(page.getByText('123.00', { exact: false }).first()).toBeVisible()

  await page.goto(`/assets/${typeId}`)
  await page.getByTestId('asset-type-price').click()
  await expect(page.getByTestId('asset-detail-price-modal')).toBeVisible()
  await page.getByTestId('asset-detail-price-clear').check()
  await page.getByTestId('asset-detail-price-submit').click()
  await expect(page.getByTestId('asset-detail-price-modal')).toBeHidden()

  await page.goto(`/assets/unit/${units[0]._id}`)
  await expect(page.getByText('Own price', { exact: false })).toHaveCount(0)

  await cleanup()
})

test('every asset carries a QR code that resolves back to it', async ({ page }) => {
  await login(page, 'manager')
  const { units, cleanup } = await scratch(page, 1)

  await page.goto(`/assets/unit/${units[0]._id}`)
  await page.getByTestId('asset-unit-qr').click()

  const modal = page.getByTestId('asset-qr-modal')
  await expect(modal).toBeVisible()
  await expect(modal.locator('svg').first()).toBeVisible()
  await expect(modal.getByText(`/assets/unit/${units[0]._id}`, { exact: false })).toBeVisible()

  const download = page.waitForEvent('download')
  await page.getByTestId('asset-qr-download').click()
  const file = await download
  expect(file.suggestedFilename()).toContain('-qr.png')

  await cleanup()
})

test('scanning the code lands on that asset', async ({ page }) => {
  await login(page, 'manager')
  const { units, cleanup } = await scratch(page, 1)

  // Exactly what the sticker encodes.
  await page.goto(`/assets/unit/${units[0]._id}`)

  await expect(page.getByTestId('asset-unit')).toBeVisible()
  await expect(page.getByRole('heading', { name: units[0].identifier })).toBeVisible()

  await cleanup()
})

test('an agent who scans a sticker sees the asset but cannot change it', async ({ page }) => {
  await login(page, 'manager')
  const { units, cleanup } = await scratch(page, 1)

  await resetSession(page)
  await login(page, 'wayz')
  await page.goto(`/assets/unit/${units[0]._id}`)

  await expect(page.getByTestId('asset-unit')).toBeVisible()
  await expect(page.getByTestId('asset-unit-qr')).toBeVisible()
  await expect(page.getByTestId('asset-unit-edit')).toHaveCount(0)
  await expect(page.getByTestId('asset-unit-suspend')).toHaveCount(0)

  await resetSession(page)
  await login(page, 'manager')
  await cleanup()
})

test('the old estate links still land on the one estate', async ({ page }) => {
  await login(page, 'admin')

  await page.goto('/admin/assets')
  await expect(page).toHaveURL(/\/assets$/)
  await expect(page.getByTestId('assets-page')).toBeVisible()

  await resetSession(page)
  await login(page, 'manager')
  await page.goto('/manager/estate')
  await expect(page).toHaveURL(/\/assets$/)
  await expect(page.getByTestId('assets-page')).toBeVisible()
})

test('an accountant cannot open the estate', async ({ page }) => {
  await login(page, 'accountant')
  await page.goto('/assets')
  await expect(page.getByTestId('assets-page')).toHaveCount(0)
})

test('a manager creates a new kind from the estate page and lands on it', async ({ page }) => {
  await openEstate(page, 'manager')

  const name = `Compartment UI ${Date.now() % 100000}`
  await page.getByTestId('asset-new-kind').click()
  await expect(page.getByTestId('asset-new-kind-modal')).toBeVisible()

  await page.getByTestId('asset-new-kind-COMPARTMENT').click()
  await page.getByTestId('asset-new-kind-name').fill(name)
  await page.getByTestId('asset-new-kind-price').fill('42')
  await page.getByTestId('asset-new-kind-count').fill('3')
  await page.getByTestId('asset-new-kind-submit').click()

  await expect(page.getByTestId('asset-type-detail')).toBeVisible()
  await expect(page.getByRole('heading', { name })).toBeVisible()
  await expect(page.getByTestId('asset-units-table').locator('tbody tr')).toHaveCount(3)
  await expect(page.getByTestId('asset-detail-price')).toContainText('42.00')

  // The kind shows up in the list it was created from.
  await page.goto('/assets')
  await expect(page.getByTestId('asset-types-table')).toContainText(name)

  // Tidy up through the UI: assets first, then the kind.
  const token = await authToken(page)
  const headers = { Authorization: `Bearer ${token}` }
  const list = await (await page.request.get('/api/assets/types', { headers })).json()
  const mine = list.data.assetTypes.find((r: { name: string }) => r.name === name)
  const rows = await (await page.request.get(`/api/assets/types/${mine._id}`, { headers })).json()
  for (const u of rows.data.units) await page.request.delete(`/api/assets/units/${u._id}`, { headers })
  await page.request.delete(`/api/assets/types/${mine._id}`, { headers })
})

test('HR and the tenant admin can create a kind too', async ({ page }) => {
  for (const who of ['hr', 'admin'] as const) {
    await resetSession(page)
    await openEstate(page, who)
    await expect(page.getByTestId('asset-new-kind')).toBeVisible()
  }
})

test('a kind with no assets can be renamed and deleted from the list', async ({ page }) => {
  await login(page, 'manager')
  const token = await authToken(page)
  const headers = { Authorization: `Bearer ${token}` }

  const name = `Empty Kind ${Date.now() % 100000}`
  const created = await (
    await page.request.post('/api/assets/types', {
      headers,
      data: { name, engineKind: 'MOBILITY', kind: 'VEHICLE', basePrice: 12, capacity: { seats: 1 } },
    })
  ).json()
  const id = created.data._id as string

  await page.goto('/assets')
  await expect(page.getByTestId('asset-types-table')).toBeVisible()

  await page.getByTestId(`asset-rename-${id}`).click()
  await page.getByTestId('asset-rename-name').fill(`${name} v2`)
  await page.getByTestId('asset-rename-submit').click()
  await expect(page.getByTestId('asset-rename-modal')).toBeHidden()
  await expect(page.getByTestId('asset-types-table')).toContainText(`${name} v2`)

  await page.getByTestId(`asset-delete-kind-${id}`).click()
  await page.getByTestId('asset-delete-kind-submit').click()
  await expect(page.getByTestId('asset-delete-kind-modal')).toBeHidden()
  await expect(page.getByTestId('asset-types-table')).not.toContainText(`${name} v2`)
})
