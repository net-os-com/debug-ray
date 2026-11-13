import { useEffect, useRef, useState } from 'react'
import { drawGame, readColors, type GameColors } from './draw'
import { LIVES, STREAK_FROM, newGame, pressSpace, step, type SonarGame } from './rules'
import { spaceIsFree } from './space-is-free'

type SonarPingProps = {
  /** The best score so far, kept between games and launches. */
  best: number
  /** The button a click last focused, which then has no claim on Space. */
  clicked: () => Element | null
  /** The palette or a modal is open over it: hold still until it closes. */
  held: boolean
  onBest: (score: number) => void
  /** Escape: back to the waiting screen. */
  onQuit: () => void
}

/** What the overlay shows; changes a few times a game, not every frame. */
type Hud = {
  score: number
  lives: number
  streak: number
  over: boolean
  paused: boolean
}

/** Text you can type into: while one has focus, the game waits for you. */
function isField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

/**
 * The game itself: a canvas the size of the empty stream, a loop that steps
 * and draws it, and the keys. The rules live in `rules.ts`; this only drives
 * them. The game state sits in a ref, so the 60 frames a second never touch
 * React — only the score line does, when it changes.
 *
 * The loop only runs while there is something to move: paused or over, the
 * last frame stays on the canvas and nothing is drawn again until it wakes.
 */
export function SonarPing({ best, clicked, held, onBest, onQuit }: SonarPingProps) {
  const wrapper = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const game = useRef<SonarGame>(newGame())
  // Three reasons to hold still: the window is in the background, something
  // is open over the game, or you are typing somewhere else in the window.
  const blurred = useRef(!document.hasFocus())
  const covered = useRef(held)
  const typing = useRef(false)
  const paused = useRef(blurred.current || covered.current)
  const resync = useRef<() => void>(() => {})
  const saved = useRef(best)
  const latest = useRef({ onBest, onQuit, clicked })
  const [hud, setHud] = useState<Hud>({
    score: 0,
    lives: LIVES,
    streak: 0,
    over: false,
    paused: paused.current,
  })

  latest.current = { onBest, onQuit, clicked }
  saved.current = Math.max(saved.current, best)

  useEffect(() => {
    covered.current = held
    resync.current()
  }, [held])

  // A new best is kept the moment it is made final: at game over, and when
  // the game is cut short — by Escape, or by the first real event arriving.
  const keepBest = (score: number): void => {
    if (score > saved.current) {
      saved.current = score
      latest.current.onBest(score)
    }
  }

  useEffect(() => {
    const element = wrapper.current
    const surface = canvas.current
    const ctx = surface?.getContext('2d')

    if (!element || !surface || !ctx) {
      return
    }

    element.focus()

    let size = { width: 0, height: 0 }
    let colors: GameColors = readColors(element)
    let frame = 0
    let running = false
    let last = performance.now()
    let overAt = 0

    const draw = (): void => drawGame(ctx, game.current, size, colors)

    const resize = (): void => {
      const dpr = window.devicePixelRatio || 1

      size = { width: element.clientWidth, height: element.clientHeight }
      surface.width = Math.round(size.width * dpr)
      surface.height = Math.round(size.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      colors = readColors(element)
      // Setting the size clears the canvas; a paused game draws no frames of
      // its own, so put the last one back.
      draw()
    }

    const sync = (): void => {
      const current = game.current
      const over = current.phase === 'over'

      setHud((shown) =>
        shown.score === current.score &&
        shown.lives === current.lives &&
        shown.streak === current.streak &&
        shown.over === over &&
        shown.paused === paused.current
          ? shown
          : {
              score: current.score,
              lives: current.lives,
              streak: current.streak,
              over,
              paused: paused.current,
            },
      )
    }

    const idle = (): boolean => paused.current || game.current.phase === 'over'

    const tick = (now: number): void => {
      const dt = (now - last) / 1000

      last = now

      if (!paused.current) {
        const before = game.current

        game.current = step(before, dt, Math.random)

        if (before.phase === 'playing' && game.current.phase === 'over') {
          overAt = now
          keepBest(game.current.score)
        }
      }

      draw()
      sync()

      if (idle()) {
        running = false

        return
      }

      frame = requestAnimationFrame(tick)
    }

    const wake = (): void => {
      if (running || idle()) {
        return
      }

      running = true
      last = performance.now()
      frame = requestAnimationFrame(tick)
    }

    // Space is the game's while it runs, from the bare page or from the game
    // itself; a field, or a button reached with the keyboard, keeps its own.
    const onKey = (event: KeyboardEvent): void => {
      const focused = document.activeElement
      const ours =
        spaceIsFree(focused, document.body, latest.current.clicked()) ||
        (focused !== null && element.contains(focused))

      // Whatever is open over the game has the keys, Escape included.
      if (!ours || covered.current) {
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        keepBest(game.current.score)
        latest.current.onQuit()

        return
      }

      if (event.key !== ' ' || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      event.preventDefault()

      if (paused.current) {
        return
      }

      game.current = pressSpace(
        game.current,
        event.repeat,
        (performance.now() - overAt) / 1000,
      )
      sync()
      wake()
    }

    const settle = (): void => {
      paused.current = blurred.current || covered.current || typing.current
      sync()
      wake()
    }

    resync.current = settle

    // In another app nobody is watching the core, so nothing may reach it.
    const onBlur = (): void => {
      blurred.current = true
      settle()
    }

    const onFocus = (): void => {
      blurred.current = false
      settle()
    }

    // Clicking into the stream's search box mid-game is typing, not playing.
    const onFocusIn = (event: FocusEvent): void => {
      typing.current = isField(event.target) && !element.contains(event.target as Node)
      settle()
    }

    const onFocusOut = (): void => {
      typing.current = false
      settle()
    }

    const resizes = new ResizeObserver(resize)
    // A theme switch changes the tokens without changing the size.
    const themed = element.closest('[data-app]')
    const themes = new MutationObserver(() => {
      colors = readColors(element)
      draw()
    })

    // Moving the window between a Retina and a plain display changes the
    // pixel ratio without changing the size, which the observer above never
    // hears. Each query matches one ratio, so it is set up again every time.
    let ratio: MediaQueryList | null = null

    const watchRatio = (): void => {
      ratio?.removeEventListener('change', onRatio)
      ratio = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`)
      ratio.addEventListener('change', onRatio)
    }

    function onRatio(): void {
      resize()
      watchRatio()
    }

    resize()
    watchRatio()
    resizes.observe(element)

    if (themed) {
      themes.observe(themed, { attributes: true, attributeFilter: ['data-app'] })
    }

    // In the capture phase, so the game sees a key before whatever is open
    // over it reacts: an Escape that closes the palette is the palette's, and
    // must not also end the game once the palette is gone.
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    wake()

    return () => {
      cancelAnimationFrame(frame)
      resizes.disconnect()
      themes.disconnect()
      ratio?.removeEventListener('change', onRatio)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      keepBest(game.current.score)
    }
    // Once per game: everything that changes is read through refs.
  }, [])

  return (
    <div className="sonar-ping" ref={wrapper} tabIndex={-1}>
      <canvas className="sonar-ping__canvas" ref={canvas} />

      <div className="sonar-ping__hud">
        {hud.streak >= STREAK_FROM ? (
          <span className="sonar-ping__streak">×{hud.streak}</span>
        ) : null}
        <span className="sonar-ping__lives">
          {'●'.repeat(hud.lives)}
          {'○'.repeat(LIVES - hud.lives)}
        </span>
        <span>
          score {hud.score} · best {Math.max(best, hud.score)}
        </span>
      </div>

      {hud.over ? (
        <div className="sonar-ping__card">
          <div className="sonar-ping__panel">
            <div className="sonar-ping__title">Game over · {hud.score}</div>
            <div className="sonar-ping__hint">space to play again · esc to stop</div>
          </div>
        </div>
      ) : hud.paused ? (
        <div className="sonar-ping__card">
          <div className="sonar-ping__panel">
            <div className="sonar-ping__title">Paused</div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
