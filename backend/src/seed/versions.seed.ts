import { Version } from '../models/index.js'
import type { VersionChange, VersionLink } from '../models/index.js'

type Draft = Omit<VersionChange, 'checks' | 'issues'>

const change = (
  area: string,
  title: string,
  detail: string,
  roles: string[],
  howToTest: string[],
  expect: string,
  links: VersionLink[] = [],
): Draft => ({ area, title, detail, roles, howToTest, expect, links })

const AGENT = 'Sign in as agent.wayz@lockerflow.demo / Agent@123'
const CEO = 'Sign in as admin.wayz@lockerflow.demo / Admin@123'
const MANAGER = 'Sign in as manager.wayz@lockerflow.demo / Manager@123'
const HR = 'Sign in as hr.wayz@lockerflow.demo / People@123'
const ACCOUNTANT = 'Sign in as accountant.wayz@lockerflow.demo / Account@123'
const COURIER = 'Sign in as courier.wayz@lockerflow.demo / Courier@123'
const CAPTAIN = 'Sign in as captain.wayz@lockerflow.demo / Lagoon@123'
const LAGOON_DESK = 'Sign in as welcome.wayz@lockerflow.demo / Lagoon@123 (the Mountain jetty desk)'

const RELEASE_ONE: Draft[] = [
  change(
    'People',
    'The role list matches the requirements document',
    'Kiosk agent, chief captain, supervisor, manager, project manager, HR, delivery agent, accountant and CEO — each with its own workspace. The cashier seat is gone: the agent is the cashier, and their name is on the invoice. COTE Restaurant, offline mode, the IT manager, the chief accountant, the roles beneath the accountant and the separate welcoming-staff seat were all dropped as redundant or out of scope.',
    ['CEO'],
    [CEO, 'Open Employees, accounts & roles', 'Press Add member and read the role list', 'Add a chief captain to a lagoon kiosk, and an agent to another lagoon kiosk'],
    'Only the agreed roles are offered, each with a sentence saying what it covers. The captain gets no point of sale and no till; the lagoon agent gets the counter narrowed to the lagoon. There is no separate welcoming-staff role — a lagoon desk is an agent on a lagoon kiosk.',
    [{ label: 'Employees, accounts & roles', to: '/manager/team' }],
  ),
  change(
    'Estate',
    'Sites, stations and kiosks — built and reshaped by you',
    'The estate is three levels: a site (a venue), its stations, and the kiosks inside them. All three can be created, renamed, re-typed, deactivated and deleted, and a kiosk belongs to exactly one activity.',
    ['CEO', 'Manager'],
    [CEO, 'Open Estate → Sites & stations', 'Add a station to a site, then add a Shop & Drop kiosk and a Mobility kiosk under it', 'Try to deactivate a station that still has live bookings'],
    'The tree grows as you build it, each kiosk carries its activity, and a station with live sessions refuses to be switched off with a plain reason.',
    [{ label: 'Sites & stations', to: '/manager/organisation' }],
  ),
  change(
    'People',
    'An agent belongs to a kiosk — and can be moved to another activity',
    'Every desk worker is attached to one kiosk. Moving them to a kiosk in a different activity moves their whole workspace with them: a Shop & Drop agent sent to a Mobility gate sells vehicles, not bags.',
    ['CEO', 'Manager'],
    [MANAGER, 'Open Team and edit an agent', 'Move them from the Iran (Shop & Drop) desk to Gate 1 (Mobility) and save', 'Sign in as that agent'],
    'Their menu changes with the kiosk: the Mobility workspace appears, Shop & Drop disappears, and everything they see — bookings, assets, the till — is that kiosk’s.',
    [{ label: 'Team', to: '/manager/team' }],
  ),
  change(
    'Security',
    'What you can see comes from your session, never from the request',
    'Tenant, station, kiosk and activity are read from the signed-in session in one place in the API. A crafted request cannot widen it.',
    ['Everyone'],
    [AGENT, 'Open a booking that belongs to your desk', 'Then edit the address bar to a booking id from another kiosk'],
    'Your own booking opens. The other desk’s booking answers "not found" — the same answer a stranger gets, so nothing leaks by existing.',
    [{ label: 'Bookings', to: '/bookings' }],
  ),
  change(
    'People',
    'Invitations, and a set-your-password page that looks like the platform',
    'A new employee is emailed a one-time link and chooses their own password — nobody at the company ever sees it. The page uses the same design as the sign-in screen, in English and Arabic.',
    ['CEO', 'Manager'],
    [MANAGER, 'Open Team → Add member and create somebody with your own email', 'Open the invitation link from the email (or the one shown when email is not configured)', 'Set a password and sign in'],
    'The link works once, the password rules are checked as you type, and accepting it signs the new person straight into their own workspace.',
    [{ label: 'Team', to: '/manager/team' }],
  ),
]

const RELEASE_TWO: Draft[] = [
  change(
    'Money',
    'No business without an open till',
    'The drawer belongs to the desk. Opening it records the float; every sale, penalty, refund and doorstep collection moves the expected cash on that shift. Only the people who actually hold a drawer see the till button.',
    ['Kiosk agent', 'Delivery agent'],
    [AGENT, 'Without opening the till, start a Shop & Drop sale and try to take payment', 'Open the till from the header and count in a float', 'Take the payment again, then open My till'],
    'The first attempt is refused with a plain reason. After opening, the payment goes through and the expected cash on the shift moves by exactly that amount. A manager or the CEO sees no till button at all.',
    [{ label: 'Shop & Drop', to: '/shop-drop' }, { label: 'My till', to: '/shift' }],
  ),
  change(
    'Money',
    'A forgotten till can be force-closed, and a variance settled',
    'A lead can close a drawer somebody walked away from, entering the counted cash themselves, and any difference is recorded and can be resolved with a reason.',
    ['Manager', 'Supervisor', 'CEO'],
    [MANAGER, 'Open Shifts and find an open till', 'Force-close it with a counted amount that does not match', 'Open the shift and record a resolution'],
    'The close is allowed with the amount you typed, the difference is shown as a variance with who closed it, and the resolution is written to the audit trail.',
    [{ label: 'Shifts', to: '/manager/shifts' }],
  ),
  change(
    'Money',
    'A refund is asked for by the desk and released by a lead',
    'An agent raises a refund with a reason; a manager, supervisor, project manager or the CEO releases it. The accountant deliberately cannot. The cash comes out of the drawer that took the money.',
    ['Kiosk agent', 'Manager', 'Accountant'],
    [AGENT, 'Open a paid booking and press Refund, enter an amount and a reason', MANAGER, 'Open Refund approvals and release it', 'Then sign in as the accountant and look for the same queue'],
    'The desk sees "waiting for approval". The lead releases it and the money leaves the drawer that took it. The accountant can read the figures but has no approve button.',
    [{ label: 'Refund approvals', to: '/refund-requests' }],
  ),
  change(
    'Money',
    'Card commissions, per scheme, as an expense',
    'Mada, Visa, Mastercard, SPAN and GCC each carry their own rate from the bank agreement. The accountant edits a rate and every figure follows. It is booked as a bank commission expense — never as tax.',
    ['Accountant', 'CEO'],
    [ACCOUNTANT, 'Open Commissions', 'Read the rates against the contract, then change the Visa rate and save'],
    'Gross minus commission equals the net settled on every row. Changing a rate reprices the figures immediately, and the page says plainly that this is an expense and not a tax.',
    [{ label: 'Commissions', to: '/accounting/commissions' }],
  ),
  change(
    'Money',
    'One invoice, on the roll and on WhatsApp',
    'A ZATCA-shaped invoice: seller, CR and VAT numbers, branch, desk, the agent on the الكاشير line, the lines, how it was paid, base and VAT, the barcode and the tracking QR. It prints at 80 mm and goes to the customer as a PDF on WhatsApp when the sale is paid.',
    ['Kiosk agent'],
    [AGENT, 'Take a payment for a customer whose WhatsApp you can read', 'Press Sales invoice on the booking and print it'],
    'The slip matches the printed invoice the client uses, and the customer receives the same document on WhatsApp with a link to follow their booking.',
    [{ label: 'Bookings', to: '/bookings' }],
  ),
  change(
    'Money',
    'Overtime: a grace period, then whole hours',
    'A stay that runs over is free inside the grace period, then charged in whole hours at the tenant’s rate. Leaving from the wrong desk carries its own penalty.',
    ['Kiosk agent', 'CEO'],
    [CEO, 'Open Operating rules and read the grace period and the hourly rate', AGENT, 'Store a bag, then use the testing clock to push it past the grace period'],
    'A minute past the grace costs a whole hour, the booking shows what is owed with the line spelled out, and the operations board shows the same figure.',
    [{ label: 'Operating rules', to: '/admin/rules' }, { label: 'Active operations', to: '/operations' }],
  ),
  change(
    'Notifications',
    'One bell, and every notice opens the thing it is about',
    'Notices are delivered by desk, by activity and by audience, with per-person read state. The separate notifications page is gone.',
    ['Everyone'],
    [AGENT, 'Open the bell in the header and click a notice'],
    'Each notice opens the page you actually have — a booking opens at your desk, the same booking opens in the manager’s workspace for a lead — and never a dead page.',
    [{ label: 'Dashboard', to: '/dashboard' }],
  ),
]

const RELEASE_THREE: Draft[] = [
  change(
    'People',
    'HR: the roster, the hours and the people log',
    'HR sets the shift window (15:00 → 01:00 by default, understood as a ten-hour night shift), reads hours actually worked per person against what the roster expected, and has a people log: sign-ins, sign-outs, tills opened, tills force-closed, variances settled and roster changes — filterable by person and by kind.',
    ['HR', 'CEO'],
    [HR, 'Open Shifts & hours', 'Change the shift window and save', 'Read hours worked per person, then open the people log and filter by one person'],
    'The window saves for the whole company, the hours line up with the tills each person opened and closed, and the log shows every sign-in, till and roster change with a timestamp.',
    [{ label: 'Shifts & hours', to: '/hr/shifts' }, { label: 'Costs', to: '/hr/costs' }],
  ),
  change(
    'Money',
    'Mobility priced by the hour or by the tour',
    'A vehicle product carries an hourly price, a tour price and how long a tour runs. HR, the manager or the CEO fill either or both, and the counter picks which one applies.',
    ['HR', 'Manager', 'CEO', 'Kiosk agent'],
    [HR, 'Open Pricing and give a scooter an hourly price and a tour price', 'Sign in as agent.gate1.wayz@lockerflow.demo / Agent@123', 'Start a Mobility sale and switch between By the hour and By the tour'],
    'The price is calculated in front of the agent before anything is created, and a product with no tour price refuses to be sold as one.',
    [{ label: 'Pricing', to: '/manager/pricing' }, { label: 'Mobility', to: '/mobility' }],
  ),
  change(
    'Lagoon',
    'The desk sells, the system fills the boats, the captain sails',
    'A lagoon desk takes the money and nothing else. Everyone who has paid is grouped by the boat they asked for and packed into loads that fit its seats, first paid first aboard. The captain takes a trip, plans the road, and sails it — no point of sale, no till, no drawer.',
    ['Kiosk agent', 'Chief captain'],
    [LAGOON_DESK, 'Open the till and sell three Abra trips (5, 4 and 3 people)', 'Open Boats & trips and press Group them into boats', CAPTAIN, 'Open My trips, take a waiting trip, and try to find anything that sells'],
    'Twelve people across eight-seat boats become two trips, in the order they paid. The captain’s workspace has trips and a chart and nothing else — no products, no till, no bookings to create.',
    [{ label: 'Boats & trips', to: '/lagoon/trips' }, { label: 'My trips', to: '/lagoon/captain' }],
  ),
  change(
    'Counter',
    'A half-finished sale picks up where it was left',
    'Clicking a draft booking does not open a dead detail page: it drops the agent back into the step they stopped at — and straight onto payment if that is all that is left.',
    ['Kiosk agent'],
    [AGENT, 'Start a Shop & Drop sale, get as far as the payment step, and leave the page', 'Open Bookings and click that draft row'],
    'You land back in the flow at the payment step with the customer, the bags and the compartment already filled in.',
    [{ label: 'Bookings', to: '/bookings' }],
  ),
  change(
    'Insight',
    'The occupancy report reads like the rest of the platform',
    'It uses the same sortable, filterable table as every other list.',
    ['Manager', 'CEO'],
    [MANAGER, 'Open Reports → Occupancy', 'Sort by a column and filter by a kiosk'],
    'Sorting and filtering behave exactly as they do on Bookings and Assets.',
    [{ label: 'Reports', to: '/manager/reports' }],
  ),
  change(
    'Counter',
    'Extensions are gone — the customer simply pays the overtime',
    'The extension flow was removed as redundant. The customer comes back, the booking shows what the overtime comes to, and the desk takes it.',
    ['Kiosk agent'],
    [AGENT, 'Open a booking that has run over and look for an extension button'],
    'There is no extension anywhere. What is owed is on the booking, and the money is taken before anything goes back.',
    [{ label: 'Bookings', to: '/bookings' }],
  ),
]

const RELEASE_FOUR: Draft[] = [
  change(
    'Estate',
    'Station map - the venue as it really stands',
    'A branded canvas of the venue. Every station and desk can be dragged onto it, or tapped from the tray and dropped with a second tap. Positions are saved on the company and read by every other screen, the captain’s chart included.',
    ['CEO'],
    [CEO, 'Open Estate then Station map', 'Drag the Egypt jetty somewhere else and press Save the map', 'Reload the page', 'Take a marker off the map with the small circular arrow, then drag it back on from the tray'],
    'The venue arrives already laid out. A dragged marker stays where you left it after a reload, and anything taken off waits in the tray until you put it back. A floor manager cannot open this page at all.',
    [{ label: 'Station map', to: '/admin/stations' }],
  ),
  change(
    'Lagoon',
    'Chart and sail - the road across the water',
    'The captain plans the road before casting off: tap the jetties in the order they will be sailed and the route is drawn and numbered on the map. The boat appears at the jetty it leaves from and moves across the water as each stop is clocked.',
    ['Chief captain'],
    [LAGOON_DESK, 'Open the till and sell two Abra trips (5 people, then 4)', 'Open Boats and trips, press Group them into boats', CAPTAIN, 'Open My trips, take the waiting trip, and press Plan the road', 'Tap Egypt, France and Mountain on the chart, press Save the road, then Cast off', 'Press Reached Egypt, then Reached France, then Reached Mountain'],
    'Cast off stays disabled until a road is saved. After casting off the boat appears on the chart, and every clocked jetty glides the boat to it, ticks the leg with the time, and points the button at the next stop. After the last jetty the trip can be finished.',
    [{ label: 'Boats and trips', to: '/lagoon/trips' }, { label: 'Chart and sail', to: '/lagoon/voyage' }],
  ),
]

const RELEASE_FOUR_MORE: Draft[] = [
  change(
    'Delivery',
    'Bags at several kiosks come home in one run',
    'The desk that takes the call is asked what else that customer is holding across the station and can send one courier to collect the lot. The courier task becomes a sub-task per kiosk.',
    ['Kiosk agent', 'Delivery agent'],
    [AGENT, 'Open booking SD-100011 from Bookings and press Send to customer', 'Read the list of other kiosks holding this customer bags, tick Bring everything', 'Choose They called or messaged, verify the customer, set a charge of 40 and create the delivery', COURIER, 'Open the till, pick the task up, then for each kiosk: Request the bags, the desk approves with a code, scan and confirm', 'At the door, try Mark delivered before paying, then take the payment and mark it delivered'],
    'The task lists one sub-task per kiosk with its compartment. Finishing one sends you to the next with the old code cleared. Handing over is refused until the whole run is paid, and every booking on it closes at the end.',
    [{ label: 'Bookings', to: '/bookings' }, { label: 'Kiosk deliveries', to: '/deliveries' }, { label: 'Courier board', to: '/courier' }],
  ),
  change(
    'Delivery',
    'A courier does nothing on a job they have not taken',
    'Taking payment and asking a kiosk for bags are both refused until the task is picked up, and the button moved to the top of the page. Couriers are told when a delivery is raised; the kiosk agent is told when a courier is at their desk.',
    ['Delivery agent', 'Kiosk agent'],
    [AGENT, 'Raise a delivery from any stored booking', COURIER, 'Open the task from the bell without pressing Pick up this task', 'Look at the top of the page, then press Pick up this task and ask the kiosk for the bags', AGENT, 'Open the bell'],
    'Before it is picked up the page offers only Pick up this task - no payment, no request. Afterwards the job opens up, and the kiosk agent has a notice that opens the release dialog with the courier name on it.',
    [{ label: 'Courier board', to: '/courier' }, { label: 'Kiosk deliveries', to: '/deliveries' }],
  ),
  change(
    'Money',
    'Checked, then paid, then handed back',
    'A booking cannot be retrieved or closed while money is owed, payment waits for the identity check, and a check is spent the moment the customer runs into more time.',
    ['Kiosk agent'],
    [AGENT, 'Store a bag, then press +60 min and move the clock 200 minutes', 'Try Begin retrieval and read the amber line above the buttons', 'Verify the customer, take the payment, then begin the retrieval'],
    'Begin retrieval is greyed out while money is owed and Take payment waits for the identity check. If the customer runs into another hour after being verified, the earlier check no longer counts.',
    [{ label: 'Bookings', to: '/bookings' }],
  ),
  change(
    'Money',
    'The invoice shows the penalty',
    'Overtime, wrong-desk penalties and the delivery charge are tagged on the printed slip and in the PDF, and a fresh invoice goes out when that money is taken.',
    ['Kiosk agent', 'Delivery agent'],
    [AGENT, 'Take an overtime payment on a booking that ran over', 'Press Sales invoice on the same booking'],
    'The overtime line carries an OVERTIME tag, the total matches what was charged, and the customer is sent the updated invoice.',
    [{ label: 'Bookings', to: '/bookings' }],
  ),
  change(
    'Across the platform',
    'Less text on every page',
    'The breadcrumb line above each title and the sentence of description below it are gone. A page leads with its title, the back arrow and its buttons.',
    ['Everyone'],
    [AGENT, 'Move between pages and look at the top of each one'],
    'Every page shows one heading and nothing else above the content. The back arrow beside the title is the way back, on every page and every role.',
    [{ label: 'Dashboard', to: '/dashboard' }, { label: 'Bookings', to: '/bookings' }],
  ),
  change(
    'Money',
    'Refund approvals reads properly',
    'The status filter was a dropdown pretending to be a statistic. It is now a segmented control beside the title.',
    ['Manager', 'Supervisor', 'CEO'],
    [MANAGER, 'Open Refund approvals and switch between All, Pending, Approved and Rejected'],
    'The filter sits next to the page title, the table reloads for each state, and there is no second filter inside the table.',
    [{ label: 'Refund approvals', to: '/refund-requests' }],
  ),
  change(
    'Across the platform',
    'These release notes',
    'A public page listing every release with the changes in it, how to test each one, and a link into the screen. Anyone who tests a change can check it off so nobody repeats it, or report a problem that stays on the card for the team to read.',
    ['Everyone'],
    ['Open /versions with no account at all', 'Open this release and press Mark as checked on a change you have tested', 'Press Report an issue on another, type what went wrong, and send it'],
    'The page reads without signing in, your name shows against what you checked, and every report is listed under its change with who wrote it and when. The release list shows how far testing has got and how many reports are open.',
    [{ label: 'All releases', to: '/versions' }],
  ),
]

const withVerdicts = (changes: Draft[]): VersionChange[] => changes.map((c) => ({ ...c, checks: [], issues: [] }))

const RELEASES = [
  {
    _id: 'ver-0001',
    number: '2026.08.21',
    name: 'Who works here, and where',
    summary:
      'The role list rebuilt around the requirements document, an estate you can shape yourself, and every screen scoped to the desk you are signed in at.',
    releasedAt: new Date('2026-08-21T06:00:00.000Z'),
    highlights: [
      'Ten roles, each with its own workspace',
      'Sites, stations and kiosks you build and reshape',
      'An agent moves kiosk - and activity - with one edit',
      'Scope comes from the session, never the request',
    ],
    changes: RELEASE_ONE,
  },
  {
    _id: 'ver-0002',
    number: '2026.08.28',
    name: 'The till, the money and the back office',
    summary:
      'The drawer moved onto the desk, refunds got an approval step, commissions and invoices came in, and overtime started charging by the hour.',
    releasedAt: new Date('2026-08-28T06:00:00.000Z'),
    highlights: [
      'No business without an open till',
      'Refunds asked for by the desk, released by a lead',
      'Card commissions per scheme, as an expense',
      'One invoice - on the roll and on WhatsApp',
      'Overtime: grace, then whole hours',
    ],
    changes: RELEASE_TWO,
  },
  {
    _id: 'ver-0003',
    number: '2026.09.01',
    name: 'HR, the lagoon split, and pricing',
    summary:
      'HR got the roster, the hours and the people log. The lagoon separated selling from sailing. Mobility can be priced by the hour or by the tour, and extensions were removed.',
    releasedAt: new Date('2026-09-01T06:00:00.000Z'),
    highlights: [
      'HR: shift window, hours worked, people log',
      'The desk sells, the system fills the boats, the captain sails',
      'Mobility priced by the hour or by the tour',
      'A half-finished sale picks up where it was left',
    ],
    changes: RELEASE_THREE,
  },
  {
    _id: 'ver-0004',
    number: '2026.09.04',
    name: 'The venue on a map, bags across kiosks',
    summary:
      'The CEO lays the venue out on a map and the captain sails it. A customer bags can be brought back from several kiosks in one run. Money is held behind an identity check, and every page reads lighter.',
    releasedAt: new Date('2026-09-04T06:00:00.000Z'),
    highlights: [
      'Station map - drag every station and desk where it really stands',
      'Chart and sail - plan the road, watch the boat move, clock each jetty',
      'One delivery covering every kiosk holding that customer bags',
      'Nothing handed back, and no money taken, before the customer is checked',
      'Release notes anyone can read, check off and report on',
    ],
    changes: [...RELEASE_FOUR, ...RELEASE_FOUR_MORE],
  },
]

export async function seedVersions() {
  await Version.deleteMany({})
  await Version.insertMany(
    RELEASES.map((release) => ({ ...release, status: 'RELEASED' as const, changes: withVerdicts(release.changes) })),
  )
  return RELEASES.length
}
