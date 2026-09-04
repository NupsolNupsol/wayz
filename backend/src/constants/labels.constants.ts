import type { EngineKind, IncidentType, Role } from '../domain/types.js'
import type { CardScheme } from '../domain/commission.js'
import type { BilingualLabel } from '../interfaces/accounting.interface.js'

export const ACTIVITY_LABELS: Record<EngineKind, BilingualLabel> = {
  LAGOON: { en: 'Lagoon', ar: 'لاجون' },
  MOBILITY: { en: 'Scooters', ar: 'اسكوترات' },
  SHOP_AND_DROP: { en: 'Shop & Drop', ar: 'شوب & دروب' },
  COTE_RESTAURANT: { en: 'COTE Restaurant', ar: 'مطعم كوت' },
  ANAAM: { en: "Ana'am", ar: 'انعام' },
}

export const SCHEME_LABELS: Record<CardScheme, BilingualLabel> = {
  MADA: { en: 'Mada Card', ar: 'مدى' },
  SPAN: { en: 'SPAN Card', ar: 'سبان' },
  VISA: { en: 'Visa Card', ar: 'فيزا' },
  MASTERCARD: { en: 'Master Card', ar: 'ماستر كارد' },
  GCC: { en: 'GCC Card', ar: 'بطاقة خليجية' },
}

export const ROLE_LABELS: Record<Role, string> = {
  AGENT: 'Kiosk agent',
  DELIVERY_AGENT: 'Delivery agent',
  SUPERVISOR: 'Supervisor',
  CHIEF_CAPTAIN: 'Chief captain',
  MANAGER: 'Activity manager',
  PROJECT_MANAGER: 'Project manager',
  HR: 'HR & expenses',
  ACCOUNTANT: 'Accountant',
  TENANT_ADMIN: 'CEO / tenant admin',
}

export const INCIDENT_LABELS: Record<IncidentType, string> = {
  MISSING_BAG: 'Missing bag',
  DAMAGED_BAG: 'Damaged bag',
  WRONG_BAG: 'Wrong bag presented',
  LABEL_ISSUE: 'Label / barcode issue',
  DAMAGE_ON_RETURN: 'Damage found on return',
  ASSET_DAMAGE: 'Asset damaged by customer',
  ASSET_FAULT: 'Asset fault / breakdown',
  ASSET_NOT_RETURNED: 'Asset not returned',
  LATE_RETURN: 'Late return',
  CUSTOMER_INJURY: 'Customer injury',
  SAFETY_CONCERN: 'Safety concern',
  ANIMAL_WELFARE: 'Animal welfare concern',
  FOOD_QUALITY: 'Food quality complaint',
  ORDER_ERROR: 'Wrong or incomplete order',
  ACCESS_ISSUE: 'Access issue (locker / area)',
  PAYMENT_DISPUTE: 'Payment dispute',
  OTHER: 'Other',
}
