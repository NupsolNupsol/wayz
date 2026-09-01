import common from './common.json'
import nav from './nav.json'
import status from './status.json'
import agent from './agent.json'
import cashier from './cashier.json'
import delivery from './delivery.json'
import ui from './ui.json'
import auth from './auth.json'
import manager from './manager.json'
import accounting from './accounting.json'
import hr from './hr.json'
import admin from './admin.json'
import assets from './assets.json'
import manual from './manual.json'
import bookings from './bookings.json'
import workflow from './workflow.json'

/** One namespace per area, so a screen only pulls in the words it uses. */
export default { common, nav, status, agent, cashier, delivery, ui, auth, manager, admin, hr, accounting, bookings, workflow, assets, manual }
