import type { IconName } from '@/components/Icon'
import type { Tone } from '@/theme/tokens'

/**
 * The seeded demo logins, offered on the sign-in screen so a device can be handed to someone
 * without a credentials note beside it.
 *
 * These exist only for the demo tenant. On a real deployment the block is empty and the picker
 * hides itself — see `DEMO_ACCOUNTS_ENABLED`.
 */
export interface DemoAccount {
  email: string
  password: string
  name: string
  role: string
  detail: string
  icon: IconName
  tone: Tone
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'agent.wayz@lockerflow.demo',
    password: 'Agent@123',
    name: 'Omar Al-Wayz',
    role: 'Kiosk agent',
    detail: 'Shop & Drop · Iran kiosk',
    icon: 'ShoppingBag',
    tone: 'brand',
  },
  {
    email: 'agent.gate1.wayz@lockerflow.demo',
    password: 'Agent@123',
    name: 'Majed Al-Subaie',
    role: 'Kiosk agent',
    detail: 'Mobility · Gate 1',
    icon: 'Bike',
    tone: 'info',
  },
  {
    email: 'welcome.wayz@lockerflow.demo',
    password: 'Lagoon@123',
    name: 'Huda Al-Qahtani',
    role: 'Kiosk agent',
    detail: 'Lagoon · Mountain kiosk',
    icon: 'Sailboat',
    tone: 'violet',
  },
  {
    email: 'courier.wayz@lockerflow.demo',
    password: 'Courier@123',
    name: 'Bilal Al-Harbi',
    role: 'Delivery agent',
    detail: 'Runs across the site',
    icon: 'Truck',
    tone: 'warn',
  },
  {
    email: 'courier2.wayz@lockerflow.demo',
    password: 'Courier@123',
    name: 'Khalid Al-Otaibi',
    role: 'Delivery agent',
    detail: 'Second courier — to test hand-offs',
    icon: 'Truck',
    tone: 'success',
  },
]

/** Off by default in a release build; the demo server sets it on. */
export const DEMO_ACCOUNTS_ENABLED = process.env.EXPO_PUBLIC_DEMO_LOGINS !== 'false'
