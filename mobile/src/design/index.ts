/**
 * The design system.
 *
 * Screens import from here and nowhere else for presentation: one import path keeps the two
 * workspaces visually identical, and makes it obvious in review when a screen reaches past the
 * system for a one-off. Primitives (button, card, text) sit in `components/ui`; the composed
 * shapes that give the app its face live beside this file.
 */

// Primitives
export { Button } from '@/components/ui/Button'
export { Card, Section } from '@/components/ui/Card'
export { CheckRow, OptionRow, Segmented, Stepper } from '@/components/ui/Controls'
export { Field, Input, TextArea } from '@/components/ui/Field'
export { EmptyState, ErrorState, Loading, Notice } from '@/components/ui/Feedback'
export { Divider, InfoRows, KeyValue, ListGroup, ListRow } from '@/components/ui/List'
export { Meter, StepBar, type WizardStep } from '@/components/ui/Progress'
export { Screen } from '@/components/ui/Screen'
export { Sheet } from '@/components/ui/Sheet'
export { StatusPill } from '@/components/ui/StatusPill'
export { Amount, Body, Heading, Label, Muted, Ref, Title } from '@/components/ui/Text'
export { toast, ToastHost } from '@/components/ui/Toast'
export { Icon, type IconName } from '@/components/Icon'
export { ScanField } from '@/components/ScanField'

// Composed shapes
export { AdaptiveTabBar } from './AdaptiveTabBar'
export { Hero, HeroChip } from './Hero'
export { ScreenHeader } from './ScreenHeader'
export { QuickActions, type QuickAction } from './QuickActions'
export { RecordCard, RecordList } from './RecordList'
export { BarChart, StepTrail, Timeline, type TimelineEntry, type TrailStep } from './Progress'
export { FeatureCard, MiniStat, StatTile, TileGrid, type TileItem } from './Tiles'
