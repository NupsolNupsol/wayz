import type { ReactNode } from 'react'
import { Text as RNText, type TextProps } from 'react-native'

type Props = TextProps & { children: ReactNode; className?: string }

/** The type scale, named. Screens never hand-roll a font size. */
export const Title = ({ children, className = '', ...rest }: Props) => (
  <RNText className={`text-2xl font-extrabold tracking-tight text-navy ${className}`} {...rest}>
    {children}
  </RNText>
)

export const Heading = ({ children, className = '', ...rest }: Props) => (
  <RNText className={`text-lg font-bold text-navy ${className}`} {...rest}>
    {children}
  </RNText>
)

export const Body = ({ children, className = '', ...rest }: Props) => (
  <RNText className={`text-[15px] leading-5 text-navy ${className}`} {...rest}>
    {children}
  </RNText>
)

export const Muted = ({ children, className = '', ...rest }: Props) => (
  <RNText className={`text-[13px] leading-5 text-muted ${className}`} {...rest}>
    {children}
  </RNText>
)

export const Label = ({ children, className = '', ...rest }: Props) => (
  <RNText className={`text-[11px] font-bold uppercase tracking-wider text-faint ${className}`} {...rest}>
    {children}
  </RNText>
)

/** A reference — a booking ref, a barcode, a unit id. Monospaced so digits line up. */
export const Ref = ({ children, className = '', ...rest }: Props) => (
  <RNText className={`font-mono text-[15px] font-semibold tracking-wide text-navy ${className}`} {...rest}>
    {children}
  </RNText>
)

/** Figures that are compared down a column stay tabular so they do not dance. */
export const Amount = ({ children, className = '', ...rest }: Props) => (
  <RNText className={`text-base font-bold text-navy ${className}`} style={{ fontVariant: ['tabular-nums'] }} {...rest}>
    {children}
  </RNText>
)
