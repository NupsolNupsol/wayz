import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

import { anonymiseRoute, PageContextRegistry, type PageContextValue } from './pageContext'
import { AssistantUiContext, type AssistantUi } from './assistantUi'

/**
 * Holds whichever page has introduced itself, plus whether the panel is open.
 *
 * The registry is a ref rather than state on purpose: a page registering itself must not
 * re-render the whole shell, and the value is only ever read at the moment a question is
 * asked. A tiny counter is kept in state so the panel's quick actions can re-label
 * themselves when the page changes underneath it.
 */

export function AssistantProvider({ children }: { children: ReactNode }) {
  const registered = useRef<PageContextValue | null>(null)
  const [pageVersion, setPageVersion] = useState(0)
  const [open, setOpen] = useState(false)
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null)
  const location = useLocation()

  const set = useCallback((value: PageContextValue | null) => {
    registered.current = value
    setPageVersion((n) => n + 1)
  }, [])

  const read = useCallback(() => registered.current, [])

  const registry = useMemo(() => ({ current: registered.current, set, read }), [set, read])

  const ui = useMemo<AssistantUi>(
    () => ({
      open,
      setOpen,
      openWith: (question: string) => {
        setPendingQuestion(question)
        setOpen(true)
      },
      pendingQuestion,
      clearPending: () => setPendingQuestion(null),
      /*
       * The route is always available even when no page registered one.
       *
       * It is the address, not the contents — `/bookings/bkg_123` becomes `/bookings/:id`
       * below so an identifier never travels with the question.
       */
      pageContext: () => {
        const current = registered.current
        const route = anonymiseRoute(location.pathname)
        if (current) return { ...current, route }
        return null
      },
      pageVersion,
      route: anonymiseRoute(location.pathname),
    }),
    [open, pendingQuestion, pageVersion, location.pathname],
  )

  return (
    <AssistantUiContext.Provider value={ui}>
      <PageContextRegistry.Provider value={registry}>{children}</PageContextRegistry.Provider>
    </AssistantUiContext.Provider>
  )
}
