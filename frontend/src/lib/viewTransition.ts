type TransitionKind = 'theme' | 'language'

interface StartViewTransition {
  startViewTransition?: (update: () => void | Promise<void>) => { finished: Promise<void> }
}

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * Runs a change that repaints the whole page as an animation instead of a flash.
 *
 * The theme wave radiates from wherever the toggle was pressed, so the new colours look like
 * they were poured from that button. Switching language cross-fades and slides the layout the
 * way it is about to read. Browsers without the API just apply the change.
 */
export function runViewTransition(
  update: () => void,
  kind: TransitionKind,
  origin?: { x: number; y: number },
): void {
  const doc = document as Document & StartViewTransition

  if (typeof doc.startViewTransition !== 'function' || prefersReducedMotion()) {
    update()
    return
  }

  const root = document.documentElement
  const point = origin ?? { x: window.innerWidth / 2, y: 0 }

  // The wave has to reach the far corner, or the old colours linger in it.
  const radius = Math.hypot(
    Math.max(point.x, window.innerWidth - point.x),
    Math.max(point.y, window.innerHeight - point.y),
  )

  root.style.setProperty('--vt-x', `${point.x}px`)
  root.style.setProperty('--vt-y', `${point.y}px`)
  root.style.setProperty('--vt-r', `${radius}px`)
  root.dataset.vt = kind

  const transition = doc.startViewTransition(update)
  void transition.finished.finally(() => {
    delete root.dataset.vt
  })
}

/**
 * Where the wave should start. A mouse gives its own coordinates; a keyboard press reports
 * none, so it starts from the middle of the control that was activated.
 */
export function originFromEvent(event: {
  clientX: number
  clientY: number
  currentTarget: Element | null
}): { x: number; y: number } {
  if (event.clientX || event.clientY) return { x: event.clientX, y: event.clientY }

  const box = event.currentTarget?.getBoundingClientRect()
  return box
    ? { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    : { x: window.innerWidth / 2, y: 0 }
}
