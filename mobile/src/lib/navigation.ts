import { router } from 'expo-router'

/**
 * Return to a tab from a screen that was pushed on top of it.
 *
 * `replace` is the wrong tool here: from inside the stack it swaps the pushed screen for a *new*
 * copy of the tab navigator, leaving the original mounted underneath — two counters, two boards,
 * and a back stack that no longer means anything. `dismissTo` pops back to the tab that is already
 * there, and only falls back to replacing it if the screen was opened cold (a deep link, or a
 * notification tapped from outside the app).
 */
export function goToTab(href: string): void {
  if (router.canDismiss()) {
    router.dismissTo(href as never)
    return
  }
  router.replace(href as never)
}

export const COURIER_TABS = {
  runs: '/(courier)/runs',
  board: '/(courier)/board',
  scan: '/(courier)/scan',
  history: '/(courier)/history',
  more: '/(courier)/more',
} as const

export const KIOSK_TABS = {
  today: '/today',
  operations: '/operations',
  sell: '/sell',
  deliveries: '/deliveries',
  more: '/(kiosk)/more',
} as const
