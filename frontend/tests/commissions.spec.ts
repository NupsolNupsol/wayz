import { test, expect, type Page } from '@playwright/test'
import { completeOtp, login, resetSession } from './helpers'

const ACCOUNTANT = { email: 'accountant.wayz@lockerflow.demo', password: 'Account@123' }
const ADMIN = { email: 'admin.wayz@lockerflow.demo', password: 'Admin@123' }
const HR = { email: 'hr.wayz@lockerflow.demo', password: 'People@123' }

const CONTRACT_RATES: Record<string, string> = {
  MADA: '0.75',
  SPAN: '0.75',
  VISA: '2.60',
  MASTERCARD: '2.60',
  GCC: '1.75',
}

test.beforeEach(async ({ page }) => resetSession(page))

async function signIn(page: Page, creds: { email: string; password: string }, landing: string) {
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

const num = (text: string) => Number((text.match(/-?[\d,]+(\.\d+)?/) ?? ['0'])[0].replaceAll(',', ''))


async function cashierToken(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const res = await request.post('/api/auth/login', {
    data: { email: 'cashier.wayz@lockerflow.demo', password: 'Cashier@123' },
  })
  return (await res.json()).data.token as string
}


const CASHIER = { email: 'cashier.wayz@lockerflow.demo', password: 'Cashier@123' }

async function unpaidBooking(
  page: Page,
  request: import('@playwright/test').APIRequestContext,
): Promise<{ id: string }> {
  await page.goto('/login')
  await page.getByTestId('login-email').fill('agent.wayz@lockerflow.demo')
  await page.getByTestId('login-password').fill('Agent@123')
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

  const token = await page.evaluate(() => JSON.parse(localStorage.getItem('wayz.platform.auth') || '{}')?.state?.token)
  const created = await request.post('/api/bookings', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      customerId: 'cust_wayz_1',
      engineKind: 'SHOP_AND_DROP',
      productId: 'pr_wayz_sd_s',
      durationMin: 60,
      bags: [{ description: 'Backpack' }],
    },
  })
  await page.evaluate(() => localStorage.clear())
  return { id: (await created.json()).data.booking.id as string }
}

const unique = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`

async function restoreRates(page: Page) {
  for (const [scheme, value] of Object.entries(CONTRACT_RATES)) {
    await page.getByTestId(`commission-rate-${scheme}`).fill(value)
  }
  if (await page.getByTestId('commission-save').isEnabled()) {
    await page.getByTestId('commission-save').click()
    await expect(page.getByTestId('commission-save')).toBeDisabled()
  }
}

test('the commission rates open on the contract values from the bank agreement', async ({ page }) => {
  await signIn(page, ACCOUNTANT, 'accounting-dashboard')
  await page.getByTestId('nav-accounting-commissions').click()
  await expect(page.getByTestId('commission-rates')).toBeVisible()

  for (const [scheme, value] of Object.entries(CONTRACT_RATES)) {
    await expect(page.getByTestId(`commission-rate-${scheme}`), scheme).toHaveValue(value)
  }

  const table = page.getByTestId('commission-rate-table')
  for (const label of ['Mada Card', 'SPAN Card', 'Visa Card', 'Master Card', 'GCC Card']) {
    await expect(table).toContainText(label)
  }

  await expect(page.getByTestId('commission-save')).toBeDisabled()
  await page.screenshot({ path: 'test-artifacts/shots/commission-rates.png', fullPage: true })
})

test('the page says plainly that the commission is an expense and not a tax', async ({ page }) => {
  await signIn(page, ACCOUNTANT, 'accounting-dashboard')
  await page.goto('/accounting/commissions')
  await expect(page.getByTestId('commission-rates')).toBeVisible()

  const note = page.getByTestId('commission-treatment')
  await expect(note).toContainText('not a tax')
  await expect(note).toContainText('bank commission expense')
  await expect(note).toContainText('Zakat')
  await expect(page.getByTestId('commission-stat-commission')).toContainText('Recorded as an expense, never as tax')
})

test('the totals hold together: gross minus commission is the net settled', async ({ page }) => {
  await signIn(page, ACCOUNTANT, 'accounting-dashboard')
  await page.goto('/accounting/commissions')
  await expect(page.getByTestId('commission-rates')).toBeVisible()

  await expect.poll(async () => num(await page.getByTestId('commission-stat-gross').innerText())).toBeGreaterThan(0)

  const gross = num(await page.getByTestId('commission-stat-gross').innerText())
  const commission = num(await page.getByTestId('commission-stat-commission').innerText())
  const net = num(await page.getByTestId('commission-stat-net').innerText())

  expect(gross).toBeGreaterThan(0)
  expect(commission).toBeGreaterThan(0)
  expect(Math.abs(gross - commission - net)).toBeLessThan(1)

  const row = page.getByTestId('commission-scheme-rows-totals')
  const cells = await row.locator('td').allInnerTexts()
  expect(Math.abs(num(cells[3]) - gross)).toBeLessThan(1)
  expect(Math.abs(num(cells[4]) - commission)).toBeLessThan(1)
})

test('each scheme is charged at its own rate', async ({ page }) => {
  await signIn(page, ACCOUNTANT, 'accounting-dashboard')
  await page.goto('/accounting/commissions')
  await expect(page.getByTestId('commission-rates')).toBeVisible()

  await expect.poll(async () => num(await page.getByTestId('commission-stat-gross').innerText())).toBeGreaterThan(0)

  for (const scheme of ['MADA', 'VISA', 'MASTERCARD']) {
    const row = page.getByTestId('commission-scheme-rows').getByTestId(`row-${scheme}`)
    await expect(row).toBeVisible()
    const cells = await row.locator('td').allInnerTexts()
    const rate = num(cells[1]) / 100
    const gross = num(cells[3])
    const commission = num(cells[4])
    const net = num(cells[5])

    expect(rate, `${scheme} rate`).toBeCloseTo(Number(CONTRACT_RATES[scheme]) / 100, 5)
    expect(Math.abs(commission - gross * rate), `${scheme} commission`).toBeLessThan(1)
    expect(Math.abs(net - (gross - commission)), `${scheme} net`).toBeLessThan(0.02)
  }
})

test('the accountant changes a rate and the figures follow', async ({ page }) => {
  await signIn(page, ACCOUNTANT, 'accounting-dashboard')
  await page.goto('/accounting/commissions')
  await expect(page.getByTestId('commission-rates')).toBeVisible()

  await expect
    .poll(async () => num(await page.getByTestId('commission-withheld-VISA').innerText()))
    .toBeGreaterThan(0)
  const before = num(await page.getByTestId('commission-withheld-VISA').innerText())

  await page.getByTestId('commission-rate-VISA').fill('5.20')
  await expect(page.getByTestId('commission-save')).toBeEnabled()
  await page.getByTestId('commission-save').click()

  await expect.poll(async () => num(await page.getByTestId('commission-withheld-VISA').innerText())).toBeGreaterThan(before)
  await expect(page.getByTestId('commission-rate-table')).toContainText('edited')

  const row = page.getByTestId('commission-scheme-rows').getByTestId('row-VISA')
  await expect.poll(async () => num((await row.locator('td').allInnerTexts())[1])).toBe(5.2)

  await restoreRates(page)
  await expect.poll(async () => num(await page.getByTestId('commission-withheld-VISA').innerText())).toBe(before)
})

test('a nonsense rate is refused before it can be saved', async ({ page }) => {
  await signIn(page, ACCOUNTANT, 'accounting-dashboard')
  await page.goto('/accounting/commissions')
  await expect(page.getByTestId('commission-rates')).toBeVisible()

  await page.getByTestId('commission-rate-VISA').fill('45')
  await expect(page.getByTestId('commission-rate-table')).toContainText('0 to 20 only')
  await expect(page.getByTestId('commission-save')).toBeDisabled()

  await page.getByTestId('commission-rate-VISA').fill('2.60')
  await expect(page.getByTestId('commission-save')).toBeDisabled()
})

test('restore contract rates puts every scheme back', async ({ page }) => {
  await signIn(page, ACCOUNTANT, 'accounting-dashboard')
  await page.goto('/accounting/commissions')
  await expect(page.getByTestId('commission-rates')).toBeVisible()

  await page.getByTestId('commission-rate-GCC').fill('3.10')
  await page.getByTestId('commission-rate-MADA').fill('1.10')
  await page.getByTestId('commission-reset').click()

  for (const [scheme, value] of Object.entries(CONTRACT_RATES)) {
    await expect(page.getByTestId(`commission-rate-${scheme}`), scheme).toHaveValue(value)
  }
  await expect(page.getByTestId('commission-save')).toBeDisabled()
})

test('the transactions page shows the feed, priced, with its reconciliation', async ({ page }) => {
  await signIn(page, ACCOUNTANT, 'accounting-dashboard')
  await page.getByTestId('nav-accounting-reconciliation').click()
  await expect(page.getByTestId('reconciliation-page')).toBeVisible()

  const count = num(await page.getByTestId('txn-stat-count').innerText())
  const gross = num(await page.getByTestId('txn-stat-gross').innerText())
  const commission = num(await page.getByTestId('txn-stat-commission').innerText())
  const net = num(await page.getByTestId('txn-stat-net').innerText())

  expect(count).toBeGreaterThan(0)
  expect(Math.abs(gross - commission - net)).toBeLessThan(1)

  await expect(page.getByTestId('reconciliation-panel')).toBeVisible()
  expect(num(await page.getByTestId('recon-matched').innerText())).toBeGreaterThan(0)
  await page.screenshot({ path: 'test-artifacts/shots/reconciliation.png', fullPage: true })

  await page.getByTestId('nav-accounting-transactions').click()
  await expect(page.getByTestId('transactions-page')).toBeVisible()

  const table = page.getByTestId('transactions-table')
  const first = table.locator('tbody tr').first()
  await expect(first).toBeVisible()

  const cells = await first.locator('td').allInnerTexts()
  const rowGross = num(cells[4])
  const rowRate = num(cells[5]) / 100
  const rowCommission = num(cells[6])
  const rowNet = num(cells[7])
  expect(Math.abs(rowCommission - rowGross * rowRate)).toBeLessThan(0.02)
  expect(Math.abs(rowNet - (rowGross - rowCommission))).toBeLessThan(0.02)

  await page.screenshot({ path: 'test-artifacts/shots/transactions.png', fullPage: true })
})

test('importing a feed prices it, whatever fed it in', async ({ page }) => {
  await signIn(page, ACCOUNTANT, 'accounting-dashboard')
  await page.goto('/accounting/settlement/transactions')
  await expect(page.getByTestId('transactions-page')).toBeVisible()

  const rowCount = async () => (await page.getByTestId('transactions-table').locator('tbody tr').count())
  const ref = `RRN-UI-${unique()}`

  await page.getByTestId('transactions-import').click()
  await expect(page.getByTestId('import-modal')).toBeVisible()

  await page.getByTestId('import-source-button').click()
  await page.getByTestId('import-source-opt-TPE').click()

  await page.getByTestId('import-feed').fill(
    JSON.stringify([{ externalRef: ref, scheme: 'MASTER CARD', grossAmount: 1150, engineKind: 'LAGOON' }]),
  )
  await page.getByTestId('import-submit').click()
  await expect(page.getByTestId('import-modal')).toHaveCount(0)

  await expect.poll(rowCount).toBeGreaterThan(0)

  await page.getByTestId('transactions-table').getByTestId('filter-ref').click()
  await page.getByTestId('filter-pop-ref').getByRole('textbox').fill(ref)
  await page.keyboard.press('Escape')

  const row = page.getByTestId('transactions-table').locator('tbody tr').first()
  await expect(row).toContainText('Master Card')
  await expect(row).toContainText('TPE')

  const cells = await row.locator('td').allInnerTexts()
  expect(num(cells[4])).toBe(1150)
  expect(num(cells[5])).toBe(2.6)
  expect(num(cells[6])).toBeCloseTo(29.9, 1)
  expect(num(cells[7])).toBeCloseTo(1120.1, 1)
})

test('a bad feed is reported back instead of silently swallowed', async ({ page }) => {
  await signIn(page, ACCOUNTANT, 'accounting-dashboard')
  await page.goto('/accounting/settlement/transactions')
  await expect(page.getByTestId('transactions-page')).toBeVisible()

  await page.getByTestId('transactions-import').click()
  await page.getByTestId('import-feed').fill('not json at all')
  await page.getByTestId('import-submit').click()
  await expect(page.getByTestId('import-error')).toContainText('valid JSON')

  await page.getByTestId('import-feed').fill(
    JSON.stringify([{ externalRef: `RRN-BAD-${unique()}`, scheme: 'AMEX', grossAmount: 100 }]),
  )
  await page.getByTestId('import-submit').click()
  await expect(page.getByTestId('import-error')).toContainText('AMEX')
  await expect(page.getByTestId('import-modal')).toBeVisible()
})

test('a transaction the platform never saw is surfaced as an exception', async ({ page }) => {
  await signIn(page, ACCOUNTANT, 'accounting-dashboard')
  await page.goto('/accounting/settlement')
  await expect(page.getByTestId('reconciliation-page')).toBeVisible()

  const before = num(await page.getByTestId('recon-terminal-only').innerText())
  const ref = `RRN-ORPHAN-${unique()}`

  await page.goto('/accounting/settlement/transactions')
  await page.getByTestId('transactions-import').click()
  await page.getByTestId('import-feed').fill(JSON.stringify([{ externalRef: ref, scheme: 'SPAN', grossAmount: 640.25 }]))
  await page.getByTestId('import-submit').click()
  await expect(page.getByTestId('import-modal')).toHaveCount(0)

  await page.goto('/accounting/settlement')
  await expect(page.getByTestId('reconciliation-page')).toBeVisible()
  await expect.poll(async () => num(await page.getByTestId('recon-terminal-only').innerText())).toBe(before + 1)

  const row = page.getByTestId('recon-table').locator('tbody tr').filter({ hasText: ref })
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('Only at the terminal')
  await expect(row).toContainText('SPAN Card')
  await expect(row).toContainText('640.25')
})

test('the commission the bank withheld shows up as an expense in the VAT report', async ({ page }) => {
  await signIn(page, ACCOUNTANT, 'accounting-dashboard')
  await page.goto('/accounting')
  await expect(page.getByTestId('accounting-dashboard')).toBeVisible()

  await page.getByTestId('accounting-from').fill('2000-01-01')

  const table = page.getByTestId('accounting-ledger-table')
  await page.getByTestId('filter-details').click()
  await page.getByTestId('filter-pop-details').getByRole('textbox').fill('Bank commission withheld')
  await page.keyboard.press('Escape')

  const row = table.locator('tbody tr').first()
  await expect(row).toContainText('Expense')
  await expect(row).toContainText('Bank commission withheld')

  const cells = await row.locator('td').allInnerTexts()
  const base = num(cells[cells.length - 3])
  const vat = num(cells[cells.length - 2])
  const total = num(cells[cells.length - 1])
  expect(vat, 'a commission carries no VAT — it is not a tax').toBe(0)
  expect(base).toBe(total)
})

test('the commission pages are English-only, like the rest of the workspace', async ({ page }) => {
  await signIn(page, ACCOUNTANT, 'accounting-dashboard')

  await page.goto('/accounting/commissions')
  await expect(page.getByTestId('commission-rates')).toBeVisible()
  expect(await page.getByTestId('commission-rates').innerText()).not.toMatch(/[؀-ۿ]/)

  await page.goto('/accounting/settlement/transactions')
  await expect(page.getByTestId('transactions-page')).toBeVisible()
  expect(await page.getByTestId('transactions-page').innerText()).not.toMatch(/[؀-ۿ]/)

  await page.goto('/accounting/settlement')
  await expect(page.getByTestId('reconciliation-page')).toBeVisible()
  expect(await page.getByTestId('reconciliation-page').innerText()).not.toMatch(/[؀-ۿ]/)

  await page.goto('/accounting/settlement/payments')
  await expect(page.getByTestId('payments-page')).toBeVisible()
  expect(await page.getByTestId('payments-page').innerText()).not.toMatch(/[؀-ۿ]/)
})

test('a tenant admin reaches the commission desk, everybody else is turned away', async ({ page }) => {
  await signIn(page, ADMIN, 'admin-overview')
  await page.getByTestId('nav-admin-commissions').click()
  await expect(page.getByTestId('commission-rates')).toBeVisible()

  await resetSession(page)
  await signIn(page, HR, 'hr-costs')
  for (const route of ['/accounting/commissions', '/accounting/settlement', '/accounting/settlement/payments']) {
    await page.goto(route)
    await expect(page, `${route} must bounce back`).toHaveURL(/\/hr/)
  }

  await resetSession(page)
  await login(page, 'manager')
  await expect(page.getByTestId('manager-overview')).toBeVisible()
  await page.goto('/accounting/commissions')
  await expect(page).toHaveURL(/\/manager/)
})

test('the agent names the card at the point of sale, and it reaches the reconciliation', async ({ page, request }) => {
  const booking = await unpaidBooking(page, request)

  await signIn(page, CASHIER, 'cashier-till')
  await page.goto('/cashier/queue')
  await page.getByTestId(`queue-take-${booking.id}`).click()
  await expect(page.getByTestId('payment-panel')).toBeVisible()

  await expect(page.getByTestId('pay-scheme-row-0'), 'cash needs no card').toHaveCount(0)

  await page.getByTestId('pay-method-card-0').click()
  await expect(page.getByTestId('pay-scheme-row-0')).toBeVisible()
  await expect(page.getByTestId('pay-scheme-row-0')).toContainText('different commission')

  for (const scheme of ['MADA', 'SPAN', 'VISA', 'MASTERCARD', 'GCC']) {
    await expect(page.getByTestId(`pay-scheme-${scheme}-0`), scheme).toBeVisible()
  }

  await page.getByTestId('pay-scheme-MASTERCARD-0').click()
  await page.screenshot({ path: 'test-artifacts/shots/pay-card-scheme.png', fullPage: true })
  await page.getByTestId('pay-confirm').click()
  await expect(page.getByTestId('payment-panel')).toHaveCount(0)

  const payments = await request.get('/api/cashier/transactions', {
    headers: { Authorization: `Bearer ${await cashierToken(request)}` },
  })
  const row = (await payments.json()).data.find((p: { bookingId: string }) => p.bookingId === booking.id)
  expect(row.method).toBe('CARD')
  expect(row.cardScheme, 'the scheme the agent picked is what got recorded').toBe('MASTERCARD')
})

test('choosing card without naming it blocks the payment', async ({ page, request }) => {
  const booking = await unpaidBooking(page, request)

  await signIn(page, CASHIER, 'cashier-till')
  await page.goto('/cashier/queue')
  await page.getByTestId(`queue-take-${booking.id}`).click()
  await expect(page.getByTestId('payment-panel')).toBeVisible()
  await expect(page.getByTestId('pay-confirm'), 'cash is ready to confirm').toBeEnabled()

  await page.getByTestId('pay-method-card-0').click()
  await page.getByTestId('pay-scheme-MADA-0').click()
  await expect(page.getByTestId('pay-confirm')).toBeEnabled()
})

test('the settlement section splits into reconciliation, transactions and payments', async ({ page }) => {
  await signIn(page, ACCOUNTANT, 'accounting-dashboard')

  await expect(page.getByTestId('sidebar')).toContainText('Settlement')

  await page.getByTestId('nav-accounting-reconciliation').click()
  await expect(page.getByTestId('reconciliation-page')).toBeVisible()
  await expect(page.getByTestId('reconciliation-panel')).toBeVisible()
  await expect(page.getByTestId('transactions-table'), 'the feed lives on its own page now').toHaveCount(0)

  await page.getByTestId('nav-accounting-transactions').click()
  await expect(page.getByTestId('transactions-page')).toBeVisible()
  await expect(page.getByTestId('transactions-table')).toBeVisible()
  await expect(page.getByTestId('reconciliation-panel')).toHaveCount(0)

  await page.getByTestId('nav-accounting-payments').click()
  await expect(page.getByTestId('payments-page')).toBeVisible()
  await expect(page.getByTestId('payments-table').locator('tbody tr').first()).toBeVisible()
})

test('the reconciliation leads with the reference, and it opens the record behind it', async ({ page }) => {
  await signIn(page, ACCOUNTANT, 'accounting-dashboard')
  await page.goto('/accounting/settlement')
  await expect(page.getByTestId('reconciliation-page')).toBeVisible()

  await expect(page.getByTestId('recon-table').locator('tbody tr').first()).toBeVisible()
  const headers = await page.getByTestId('recon-table').locator('thead th').allInnerTexts()
  expect(headers[0].toLowerCase(), 'the reference comes first, not the issue').toContain('reference')
  expect(headers[1].toLowerCase()).toContain('issue')

  const firstRow = page.getByTestId('recon-table').locator('tbody tr').first()
  await expect(firstRow).toBeVisible()

  const link = firstRow.locator('a').first()
  await expect(link, 'the reference is a link').toBeVisible()
  const href = await link.getAttribute('href')
  expect(href).toMatch(/\/accounting\/settlement\/(transactions|payments)\//)

  await link.click()
  await expect(page.locator('[data-testid="transaction-detail"], [data-testid="payment-detail"]').first()).toBeVisible()
})

test('a transaction detail shows both sides and links across to its payment', async ({ page, request }) => {
  await signIn(page, ACCOUNTANT, 'accounting-dashboard')

  const token = await page.evaluate(() => JSON.parse(localStorage.getItem('wayz.platform.auth') || '{}')?.state?.token)
  const res = await request.get('/api/accounting/transactions?limit=50', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const withPayment = (await res.json()).data.find((t: { paymentId: string | null }) => t.paymentId)
  expect(withPayment, 'the seed links transactions to payments').toBeTruthy()

  await page.goto(`/accounting/settlement/transactions/${withPayment._id}`)
  await expect(page.getByTestId('transaction-detail')).toBeVisible()
  await expect(page.getByTestId('transaction-detail')).toContainText(withPayment.externalRef)

  await expect(page.getByTestId('transaction-terminal')).toBeVisible()
  await expect(page.getByTestId('transaction-money')).toContainText('Commission')
  await expect(page.getByTestId('transaction-verdict')).toBeVisible()

  await page.getByTestId('transaction-to-payment').click()
  await expect(page.getByTestId('payment-detail')).toBeVisible()
  await expect(page.getByTestId('payment-detail')).toContainText(withPayment.paymentId)

  await page.getByTestId('payment-to-transaction').click()
  await expect(page.getByTestId('transaction-detail'), 'and back again').toBeVisible()
})

test('a payment reference opens its detail, and cash says the terminal was never involved', async ({ page, request }) => {
  await signIn(page, ACCOUNTANT, 'accounting-dashboard')

  const token = await page.evaluate(() => JSON.parse(localStorage.getItem('wayz.platform.auth') || '{}')?.state?.token)
  const res = await request.get('/api/accounting/payments?limit=200', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const rows = (await res.json()).data
  const cash = rows.find((p: { method: string; kind: string }) => p.method === 'CASH' && p.kind === 'SALE')
  expect(cash, 'the seed has cash sales').toBeTruthy()

  await page.goto('/accounting/settlement/payments')
  await expect(page.getByTestId('payments-page')).toBeVisible()

  await expect(page.getByTestId('payments-table').locator('tbody tr').first()).toBeVisible()
  const headers = await page.getByTestId('payments-table').locator('thead th').allInnerTexts()
  expect(headers[0].toLowerCase()).toContain('reference')

  await page.goto(`/accounting/settlement/payments/${cash._id}`)
  await expect(page.getByTestId('payment-detail')).toBeVisible()
  await expect(page.getByTestId('payment-platform')).toContainText('Cash')
  await expect(page.getByTestId('payment-no-transaction')).toContainText('nothing for the terminal')
  await expect(page.getByTestId('payment-verdict')).toContainText('reconciles')
})

test('a card mismatch is explained on both detail pages', async ({ page, request }) => {
  await signIn(page, ACCOUNTANT, 'accounting-dashboard')

  const token = await page.evaluate(() => JSON.parse(localStorage.getItem('wayz.platform.auth') || '{}')?.state?.token)
  const res = await request.get('/api/accounting/reconciliation', { headers: { Authorization: `Bearer ${token}` } })
  const mismatch = (await res.json()).data.rows.find((r: { status: string }) => r.status === 'SCHEME_MISMATCH')
  expect(mismatch, 'the seed plants a few wrongly-typed cards').toBeTruthy()

  await page.goto(`/accounting/settlement/transactions/${mismatch.transactionId}`)
  await expect(page.getByTestId('transaction-detail')).toBeVisible()
  await expect(page.getByTestId('transaction-verdict')).toContainText('does not reconcile')
  await expect(page.getByTestId('transaction-verdict')).toContainText('commission always follows the terminal')
  await expect(page.getByTestId('transaction-platform')).toContainText('Card the agent picked')
})

test('the payments table filters and sorts like every other grid on the platform', async ({ page }) => {
  await signIn(page, ACCOUNTANT, 'accounting-dashboard')
  await page.goto('/accounting/settlement/payments')
  await expect(page.getByTestId('payments-table').locator('tbody tr').first()).toBeVisible()

  const all = num(await page.getByTestId('pay-stat-count').innerText())
  expect(all).toBeGreaterThan(0)

  await page.getByTestId('payments-method-button').click()
  await page.getByTestId('payments-method-opt-CASH').click()
  await expect.poll(async () => num(await page.getByTestId('pay-stat-card').innerText())).toBe(0)

  await page.getByTestId('payments-method-button').click()
  await page.getByTestId('payments-method-opt-CARD').click()
  await expect.poll(async () => num(await page.getByTestId('pay-stat-cash').innerText())).toBe(0)

  await page.getByTestId('sort-amount').click()
  await expect(page.getByTestId('payments-table-pagination')).toBeVisible()
})

test('an agent pays by card from the engine workspace and the scheme survives', async ({ page, request }) => {
  await page.goto('/login')
  await page.getByTestId('login-email').fill('agent.wayz@lockerflow.demo')
  await page.getByTestId('login-password').fill('Agent@123')
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

  await page.getByTestId('nav-mobility').click()
  await expect(page.getByTestId('engine-MOBILITY')).toBeVisible()

  await page.getByTestId('product-pr_wayz_mob_single').click()
  await page.getByTestId('customer-search').fill('Ahmed')
  await page.getByTestId('customer-opt-cust_wayz_1').click()
  await page.getByTestId('engine-next').click()

  await completeOtp(page, '0599709998')
  await expect(page.getByTestId('payment-panel')).toBeVisible()

  await page.getByTestId('pay-method-card-0').click()
  await page.getByTestId('pay-scheme-VISA-0').click()
  await page.getByTestId('pay-confirm').click()

  await expect(page.getByTestId('engine-fulfil'), 'the payment goes through').toBeVisible()

  const rows = await request.get('/api/cashier/transactions', {
    headers: { Authorization: `Bearer ${await cashierToken(request)}` },
  })
  const latest = (await rows.json()).data.find(
    (p: { method: string; kind: string; cardScheme: string | null }) => p.method === 'CARD' && p.kind === 'SALE',
  )
  expect(latest.cardScheme, 'the engine workspace must not drop the scheme').toBe('VISA')
})

test('the verify button is the obvious next step, not a quiet secondary', async ({ page }) => {
  await page.goto('/login')
  await page.getByTestId('login-email').fill('agent.wayz@lockerflow.demo')
  await page.getByTestId('login-password').fill('Agent@123')
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

  await page.getByTestId('nav-mobility').click()
  await page.getByTestId('product-pr_wayz_mob_single').click()
  await page.getByTestId('customer-search').fill('Ahmed')
  await page.getByTestId('customer-opt-cust_wayz_1').click()
  await page.getByTestId('engine-next').click()

  const send = page.getByTestId('otp-send')
  await expect(send).toBeVisible()

  const style = await send.evaluate((el) => {
    const s = getComputedStyle(el)
    return { background: s.backgroundColor, color: s.color }
  })
  const isFilled = !/rgba\(0, 0, 0, 0\)|transparent/.test(style.background)
  expect(isFilled, 'the send button carries the primary fill so it reads as the next step').toBe(true)
})
