import { Link } from 'react-router-dom'
import { clsx } from 'clsx'

const REF_STYLE = 'font-mono text-sm font-semibold'

export function RefLink({
  to,
  children,
  title,
  className,
  testId,
}: {
  to: string
  children: React.ReactNode
  title?: string
  className?: string
  testId?: string
}) {
  return (
    <Link
      to={to}
      title={title}
      data-testid={testId}
      onClick={(e) => e.stopPropagation()}
      className={clsx(REF_STYLE, 'text-brand no-underline hover:underline focus:underline', className)}
    >
      {children}
    </Link>
  )
}

export function RefText({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={clsx(REF_STYLE, 'text-navy dark:text-dk-text', className)}>{children}</span>
}
