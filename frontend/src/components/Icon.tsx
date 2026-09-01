import {
  LayoutDashboard, CirclePlus, ShoppingBag, Bike, Sailboat, UtensilsCrossed, Rabbit,
  Activity, Grid3x3, TriangleAlert, Users, CalendarCheck, Clock, UserCog, Sparkles,
  Package, Boxes, ShoppingCart, Car, Baby, Accessibility, Ship, Anchor, Coffee,
  Beef, Salad, GlassWater, Bird, Timer, PackageCheck, Wallet, Receipt, Truck,
  Building2, Tag, Settings, ChartLine, ScrollText, Banknote, BookOpen, Blocks,
  MapPin, PackageOpen, Bell, ClipboardCheck, CalendarRange, Percent, CreditCard, Scale,
  Circle, type LucideProps, type LucideIcon,
} from 'lucide-react'

const REGISTRY: Record<string, LucideIcon> = {
  LayoutDashboard, CirclePlus, ShoppingBag, Bike, Sailboat, UtensilsCrossed, Rabbit,
  Activity, Grid3x3, TriangleAlert, Users, CalendarCheck, Clock, UserCog, Sparkles,
  Package, Boxes, ShoppingCart, Car, Baby, Accessibility, Ship, Anchor, Coffee,
  Beef, Salad, GlassWater, Bird, Timer, PackageCheck, Wallet, Receipt, Truck,
  Building2, Tag, Settings, ChartLine, ScrollText, Banknote, BookOpen, Blocks,
  MapPin, PackageOpen, Bell, ClipboardCheck, CalendarRange, Percent, CreditCard, Scale,
}

export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = REGISTRY[name] ?? Circle
  return <Cmp {...props} />
}
