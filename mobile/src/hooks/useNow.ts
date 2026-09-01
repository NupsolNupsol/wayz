import { useEffect, useState } from 'react'

/**
 * A clock the render can read. Anything that compares against "now" — a countdown, a
 * verification that expires, a code that times out — needs the component to re-render as time
 * passes, not to read the clock once and go stale.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return now
}
