// src/components/Icon.tsx
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpFromLine,
  BadgeDollarSign,
  Banknote,
  Bike,
  Boxes,
  Camera,
  Check,
  CheckCircle,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Coins,
  CreditCard,
  Filter,
  Gift,
  Grid3x3,
  Home,
  Landmark,
  LogOut,
  MapPin,
  MoreHorizontal,
  Package,
  PackageCheck,
  Phone,
  PlusCircle,
  Rabbit,
  Receipt,
  RefreshCw,
  ScanLine,
  Sailboat,
  Search,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Undo2,
  User,
  Users,
  UtensilsCrossed,
  Wallet,
  X,
} from 'lucide-react-native'

import { COLORS } from '@/theme/tokens'

const REGISTRY = {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpFromLine,
  BadgeDollarSign,
  Banknote,
  Bike,
  Boxes,
  Camera,
  Check,
  CheckCircle,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Coins,
  CreditCard,
  Filter,
  Gift,
  Grid3x3,
  Home,
  Landmark,
  LogOut,
  MapPin,
  MoreHorizontal,
  Package,
  PackageCheck,
  Phone,
  PlusCircle,
  Rabbit,
  Receipt,
  RefreshCw,
  ScanLine,
  Sailboat,
  Search,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Undo2,
  User,
  Users,
  UtensilsCrossed,
  Wallet,
  X,
} as const

export type IconName = keyof typeof REGISTRY

export function Icon({
  name,
  size = 20,
  color = COLORS.navy,
  strokeWidth = 2,
}: {
  name: IconName | string
  size?: number
  color?: string
  strokeWidth?: number
}) {
  const Glyph = REGISTRY[name as IconName] ?? Package
  if (!REGISTRY[name as IconName]) {
    console.warn(
      `[Icon] Unknown "${name}". Available: ${Object.keys(REGISTRY).join(', ')}`,
    )
  }
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} />
}