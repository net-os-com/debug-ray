import { useEffect, useRef } from 'react'
import { advance, draw, isFinished, palette, spawn, type Particle } from './confetti'

/**
 * Fires on every ray()->confetti(). Sits above everything and ignores the
 * mouse, so it never gets in the way of the stream underneath.
 */
export function ConfettiOverlay({ trigger }: { trigger: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (trigger === 0) {
      return
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const element = canvas.current
    const context = element?.getContext('2d')

    if (!element || !context) {
      return
    }

    const ratio = window.devicePixelRatio || 1
    const width = element.clientWidth
    const height = element.clientHeight

    element.width = width * ratio
    element.height = height * ratio
    context.setTransform(ratio, 0, 0, ratio, 0, 0)

    let particles: Particle[] = spawn(width, height, palette())
    let frame = 0
    let start = 0
    let previous = 0

    const step = (now: number): void => {
      if (start === 0) {
        start = now
        previous = now
      }

      const elapsed = now - start

      advance(particles, elapsed, Math.min(now - previous, 50))
      draw(context, particles, elapsed)
      previous = now

      if (isFinished(elapsed)) {
        context.clearRect(0, 0, element.width, element.height)

        return
      }

      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(frame)
      particles = []
      context.clearRect(0, 0, element.width, element.height)
    }
  }, [trigger])

  return <canvas aria-hidden="true" className="confetti" ref={canvas} />
}
