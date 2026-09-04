type TransitionKind = 'theme' | 'language'

interface StartViewTransition {
  startViewTransition?: (update: () => void | Promise<void>) => { finished: Promise<void> }
}

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

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
