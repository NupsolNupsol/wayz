import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'

import { learningApi } from '@/api/learning.api'
import { useAuthStore } from '@/store/auth'
import { RESTART_TOUR_EVENT } from './restartTour'
import { tourFor, type TourStep } from './tours'

/**
 * A guided tour that cannot break the application.
 *
 * That is the whole design constraint. A tour is decoration on top of a working product, and
 * a missing sidebar entry — a company that never enabled deliveries, a role without a till —
 * must never be a blank screen. So:
 *
 *   - a step whose anchor is not on the page is shown centred rather than skipped or crashed
 *   - measuring is wrapped and re-run on resize and scroll, never assumed
 *   - the overlay is a portal with an explicit escape hatch on every step
 *   - progress is saved optimistically; a failed save costs the record, not the tour
 *
 * The spotlight is one absolutely-positioned box with a very large outward shadow, which
 * dims everything except the element and needs no SVG mask or clip-path.
 */

const PADDING = 8
const CARD_WIDTH = 320
const GAP = 14

interface Box {
  top: number
  left: number
  width: number
  height: number
}

function measure(selector: string | undefined): Box | null {
  if (!selector) return null
  try {
    const element = document.querySelector(selector)
    if (!element) return null
    const rect = element.getBoundingClientRect()
    // An element that is present but collapsed (a closed sidebar) is not something to point
    // at, so it is treated exactly like one that is absent.
    if (rect.width < 4 || rect.height < 4) return null
    return {
      top: rect.top - PADDING,
      left: rect.left - PADDING,
      width: rect.width + PADDING * 2,
      height: rect.height + PADDING * 2,
    }
  } catch {
    // A malformed selector in configuration must not take the workspace down with it.
    return null
  }
}

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(value, Math.max(low, high)))

/**
 * Where the card goes: under the anchor if there is room, above it if not, and always
 * inside the viewport.
 *
 * Both axes are clamped, and against the card's *measured* height rather than a guess.
 * Guessing put the card off the bottom of the screen whenever it was anchored to a low
 * sidebar entry — visible to the accessibility tree, unreachable with a mouse, which is the
 * worst of both worlds.
 */
function cardPosition(
  box: Box | null,
  cardHeight: number,
): { top: number; left: number; centred: boolean } {
  const maxTop = window.innerHeight - cardHeight - GAP
  const maxLeft = window.innerWidth - CARD_WIDTH - GAP

  if (!box) {
    return {
      top: clamp(window.innerHeight / 2 - cardHeight / 2, GAP, maxTop),
      left: clamp(window.innerWidth / 2 - CARD_WIDTH / 2, GAP, maxLeft),
      centred: true,
    }
  }

  const below = box.top + box.height + GAP
  const above = box.top - cardHeight - GAP
  const fitsBelow = below + cardHeight + GAP <= window.innerHeight
  const preferred = fitsBelow ? below : above

  return {
    top: clamp(preferred, GAP, maxTop),
    left: clamp(box.left + box.width / 2 - CARD_WIDTH / 2, GAP, maxLeft),
    centred: false,
  }
}

export function OnboardingTour() {
  const role = useAuthStore((s) => s.me?.role)
  const tour = tourFor(role)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation(['onboarding', 'common'])

  const [running, setRunning] = useState(false)
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [cardHeight, setCardHeight] = useState(220)

  const state = useQuery({
    queryKey: ['learning', 'onboarding'],
    queryFn: learningApi.onboarding,
    retry: false,
    staleTime: 5 * 60_000,
  })

  const save = useMutation({
    mutationFn: learningApi.saveOnboarding,
    onSuccess: (data) => queryClient.setQueryData(['learning', 'onboarding'], data),
  })

  // Starts itself once, for somebody who has never been shown it.
  useEffect(() => {
    if (!tour || running) return
    if (!state.data?.shouldAutoStart) return
    if (state.data.tourKey !== tour.key) return
    const start = Math.min(state.data.stepIndex, tour.steps.length - 1)
    setIndex(start)
    setRunning(true)
    // Recorded immediately, not on the first "next". Otherwise closing the tab on step one
    // leaves the row PENDING and the overlay is waiting again at the next sign-in.
    save.mutate({ status: 'IN_PROGRESS', stepIndex: start })
    // `save` is a new object each render; depending on it would re-fire this on every one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour, running, state.data])

  // The training page asks for it again by name.
  useEffect(() => {
    const restart = () => {
      setIndex(0)
      setRunning(true)
      save.mutate({ status: 'IN_PROGRESS', stepIndex: 0, restart: true })
    }
    window.addEventListener(RESTART_TOUR_EVENT, restart)
    return () => window.removeEventListener(RESTART_TOUR_EVENT, restart)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const step: TourStep | undefined = tour?.steps[index]

  // Navigate before measuring, so the anchor exists by the time we look for it.
  useEffect(() => {
    if (running && step?.route) navigate(step.route)
  }, [running, step?.route, navigate])

  const remeasure = useCallback(() => {
    if (!running || !step) return
    setBox(step.placement === 'center' ? null : measure(step.target))
  }, [running, step])

  // Re-measured whenever the step changes: a two-line step and a five-line step are not the
  // same height, and the clamp above is only as good as the number it is given. The 4px
  // threshold is what stops a sub-pixel difference becoming a render loop.
  useLayoutEffect(() => {
    if (!running) return
    const height = cardRef.current?.offsetHeight
    if (height && Math.abs(height - cardHeight) > 4) setCardHeight(height)
  }, [running, index, cardHeight])

  useLayoutEffect(() => {
    if (!running) return
    remeasure()
    // A step that navigated needs a beat for the destination to paint before it is measured.
    const settle = window.setTimeout(remeasure, 180)
    window.addEventListener('resize', remeasure)
    window.addEventListener('scroll', remeasure, true)
    return () => {
      window.clearTimeout(settle)
      window.removeEventListener('resize', remeasure)
      window.removeEventListener('scroll', remeasure, true)
    }
  }, [running, remeasure])

  const finish = useCallback(
    (status: 'COMPLETED' | 'SKIPPED') => {
      setRunning(false)
      save.mutate({ status, stepIndex: index })
    },
    [index, save],
  )

  const go = useCallback(
    (next: number) => {
      if (!tour) return
      if (next >= tour.steps.length) return finish('COMPLETED')
      setIndex(next)
      save.mutate({
        status: 'IN_PROGRESS',
        stepIndex: next,
        completedStep: tour.steps[next - 1]?.id,
      })
    },
    [tour, finish, save],
  )

  useEffect(() => {
    if (!running) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish('SKIPPED')
      if (e.key === 'ArrowRight' || e.key === 'Enter') go(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [running, index, finish, go])

  if (!running || !tour || !step) return null

  const position = cardPosition(box, cardHeight)
  const last = index === tour.steps.length - 1

  return createPortal(
    <div className="fixed inset-0 z-[3500]" role="dialog" aria-modal="true" data-testid="onboarding-tour">
      {box ? (
        <div
          className="absolute rounded-xl pointer-events-none transition-all duration-200"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
            boxShadow: '0 0 0 9999px rgb(15 23 42 / 0.62)',
            outline: '2px solid rgb(var(--brand))',
          }}
          data-testid="onboarding-spotlight"
        />
      ) : (
        <div className="absolute inset-0 bg-navy-900/60" />
      )}

      <div
        className={clsx(
          'absolute lf-card p-4 shadow-pop w-[320px] max-w-[calc(100vw-2rem)]',
          position.centred && 'transition-none',
        )}
        style={{ top: position.top, left: position.left }}
        data-testid="onboarding-card"
        ref={cardRef}
      >
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted mb-1">
          {t('progress', { current: index + 1, total: tour.steps.length })}
        </p>
        <h3 className="font-bold text-navy dark:text-dk-texthi mb-1.5">
          {t(`step.${step.id}.title`)}
        </h3>
        <p className="text-sm text-muted leading-relaxed">{t(`step.${step.id}.body`)}</p>

        <div className="flex items-center justify-between gap-2 mt-4">
          <button
            type="button"
            onClick={() => finish('SKIPPED')}
            data-testid="onboarding-skip"
            className="text-xs text-muted hover:text-navy dark:hover:text-dk-texthi"
          >
            {t('skip')}
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex(index - 1)}
                data-testid="onboarding-back"
                className="lf-btn-ghost h-9 px-3 text-sm"
              >
                {t('back', { ns: 'common', defaultValue: 'رجوع' })}
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? finish('COMPLETED') : go(index + 1))}
              data-testid="onboarding-next"
              className="lf-btn-primary h-9 px-4 text-sm"
            >
              {last ? t('finish') : t('next')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
