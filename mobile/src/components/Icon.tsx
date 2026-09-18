import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bike,
  Boxes,
  Camera,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock,
  CreditCard,
  Grid3x3,
  Home,
  LogOut,
  MapPin,
  MoreHorizontal,
  Package,
  PackageCheck,
  Phone,
  PlusCircle,
  Rabbit,
  ScanLine,
  Sailboat,
  Search,
  ShieldCheck,
  ShoppingBag,
  Truck,
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
  ArrowLeft,
  ArrowRight,
  Bike,
  Boxes,
  Camera,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock,
  CreditCard,
  Grid3x3,
  Home,
  LogOut,
  MapPin,
  MoreHorizontal,
  Package,
  PackageCheck,
  Phone,
  PlusCircle,
  Rabbit,
  ScanLine,
  Sailboat,
  Search,
  ShieldCheck,
  ShoppingBag,
  Truck,
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
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} />
}
