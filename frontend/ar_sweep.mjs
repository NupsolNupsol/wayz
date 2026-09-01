import { chromium } from '@playwright/test'

const ROUTES = {
  agent: {
    creds: ['agent.wayz@lockerflow.demo', 'Agent@123'],
    landing: 'dashboard',
    paths: ['/dashboard', '/pos', '/shop-drop', '/mobility', '/operations', '/assets', '/incidents', '/customers', '/bookings', '/shift', '/profile', '/help/manual'],
  },
  cashier: {
    creds: ['cashier.wayz@lockerflow.demo', 'Cashier@123'],
    landing: 'cashier-till',
    paths: ['/cashier', '/cashier/queue', '/cashier/transactions', '/cashier/drawer', '/cashier/shift'],
  },
  courier: {
    creds: ['courier.wayz@lockerflow.demo', 'Courier@123'],
    landing: 'courier-board',
    paths: ['/courier', '/courier/history'],
  },
  manager: {
    creds: ['manager.wayz@lockerflow.demo', 'Manager@123'],
    landing: 'manager-overview',
    paths: ['/manager', '/manager/live', '/manager/rentals', '/manager/customers', '/manager/payments', '/manager/incidents', '/manager/shifts', '/manager/organisation', '/assets', '/manager/pricing', '/manager/team', '/manager/settings', '/manager/reports', '/manager/activity'],
  },
  admin: {
    creds: ['admin.wayz@lockerflow.demo', 'Admin@123'],
    landing: 'admin-overview',
    paths: ['/admin', '/admin/company', '/admin/people', '/assets', '/admin/audit', '/admin/isolation'],
  },
  hr: {
    creds: ['hr.wayz@lockerflow.demo', 'People@123'],
    landing: 'hr-costs',
    paths: ['/hr', '/hr/seasons', '/hr/seasons/ssn-0001', '/assets'],
  },
  accountant: {
    creds: ['accountant.wayz@lockerflow.demo', 'Account@123'],
    landing: 'accounting-dashboard',
    paths: ['/accounting', '/accounting/commissions', '/accounting/settlement', '/accounting/settlement/transactions', '/accounting/settlement/payments'],
  },
}

const BASE = 'http://localhost:5175'

// Words that are legitimately Latin in an Arabic UI: brand names, codes, ids.
const ALLOWED = /^(WAYZ|WIQAR|LockerFlow|SAR|VAT|CSV|QR|OTP|KDS|ZATCA|Mada|SPAN|Visa|Master ?Card|GCC|EN|AR|[A-Z]{2,5}-[A-Z0-9-]+|[a-z0-9.]+@[a-z.]+|pay-\d+|bk-\d+|dlv-\d+|cm-\d+|exp-\d+|txn-\d+|usr[_-][a-z0-9_]+|ssn-\d+|SD-\d+|MB-\d+|LG-\d+|INC-\d+|[XSML]-\d+|[0-9.,:%+−-]+|[A-Z]{1,3}\d*)$/

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

/**
 * Names, addresses and product names come out of the database; they are content, not UI copy,
 * and an Arabic UI showing an English customer name is correct. They are read from the API so
 * the sweep never has to guess.
 */
async function tenantContent(token) {
  const headers = { Authorization: `Bearer ${token}` }
  const get = async (url) => {
    const res = await page.request.get(BASE + url, { headers })
    return res.ok() ? (await res.json()).data : null
  }
  const words = new Set()
  const add = (value) => {
    if (typeof value !== 'string') return
    for (const word of value.split(/[\s·,()—–|/]+/)) if (word.length > 1) words.add(word)
    words.add(value.trim())
  }

  const [customers, estate, org, staff, seasons, products] = await Promise.all([
    get('/api/manager/customers'),
    get('/api/assets/types'),
    get('/api/manager/org'),
    get('/api/manager/staff'),
    get('/api/hr/seasons'),
    get('/api/manager/pricing'),
  ])

  for (const c of customers ?? []) { add(c.name); add(c.phone); add(c.email) }
  for (const t of estate?.assetTypes ?? []) { add(t.name); for (const s of t.stationNames ?? []) add(s) }
  for (const s of estate?.stations ?? []) add(s.name)
  for (const site of org?.sites ?? []) {
    add(site.name); add(site.city); add(site.venueType)
    for (const st of site.stations ?? []) {
      add(st.name)
      for (const k of st.kiosks ?? []) add(k.name)
    }
  }
  for (const u of staff ?? []) { add(u.fullName); add(u.email); add(u.stationName); add(u.kioskName) }
  for (const s of seasons ?? []) add(s.name)
  for (const p of products?.products ?? []) { add(p.name); add(p.category); add(p.assetTypeName) }
  return words
}

async function signIn([email, password], landing) {
  await page.goto(`${BASE}/login`)
  await page.evaluate(() => localStorage.clear())
  await page.goto(`${BASE}/login`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.getByTestId(landing).waitFor({ timeout: 30000 })
  if (!(await page.evaluate(() => document.documentElement.lang === 'ar'))) {
    await page.getByTestId('language-toggle').click()
    await page.waitForTimeout(600)
  }
  return page.evaluate(() => JSON.parse(localStorage.getItem('wayz.platform.auth') || '{}')?.state?.token)
}

// One privileged sign-in builds the content list the whole sweep filters against.
const adminToken = await signIn(ROUTES.admin.creds, ROUTES.admin.landing)
const CONTENT = await tenantContent(adminToken)

const findings = []

for (const [role, config] of Object.entries(ROUTES)) {
  await signIn(config.creds, config.landing)

  for (const path of config.paths) {
    await page.goto(BASE + path)
    await page.waitForTimeout(1200)

    const english = await page.evaluate(() => {
      const out = []
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        // A stylesheet is not copy.
        if (node.parentElement?.closest('style, script, svg')) continue
        const text = node.textContent.trim()
        if (!text || text.length < 3) continue
        if (/[A-Za-z]{3,}/.test(text) && !/[؀-ۿ]/.test(text)) out.push(text)
      }
      return [...new Set(out)]
    })

    const leaks = english.filter(
      (s) => !CONTENT.has(s) && !s.split(/\s+/).every((w) => ALLOWED.test(w) || CONTENT.has(w)),
    )
    if (leaks.length) findings.push({ role, path, leaks })

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    const dir = await page.evaluate(() => document.documentElement.dir)
    if (overflow > 2 || dir !== 'rtl') findings.push({ role, path, layout: { overflow, dir } })
  }
}

await browser.close()

if (!findings.length) {
  console.log('CLEAN — no untranslated copy and no layout break on any screen')
} else {
  for (const f of findings) console.log(JSON.stringify(f))
  console.log(`\n${findings.length} screens with findings`)
}
