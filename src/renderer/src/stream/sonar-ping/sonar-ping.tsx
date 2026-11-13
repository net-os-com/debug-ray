import { useEffect, useRef, useState } from 'react'
import { drawGame, readColors, type GameColors } from './draw'
import { LIVES, newGame, pressSpace, step, type SonarGame } from './rules'

type SonarPingProps = {
  /** The best score so far, kept between games and launches. */
  best: number
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
  over: boolean
  paused: boolean
}

/**
 * The game itself: a canvas the size of the empty stream, a loop that steps
 * and draws it, and the keys. The rules live in `rules.ts`; this only drives
 * them. The game state sits in a ref, so the 60 frames a second never touch
 * React — only the score line does, when it changes.
 */
export function SonarPing({ best, held, onBest, onQuit }: SonarPingProps) {
  const wrapper = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const game = useRef<SonarGame>(newGame())
  // Two reasons to hold still: the window is in the background, or something
  // is open over the game. Either one pauses it.
  const blurred = useRef(!document.hasFocus())
  const covered = useRef(held)
  const paused = useRef(blurred.current || covered.current)
  const resync = useRef<() => void>(() => {})
  const saved = useRef(best)
  const latest = useRef({ onBest, onQuit })
  const [hud, setHud] = useState<Hud>({
    score: 0,
    lives: LIVES,
    over: false,
    paused: paused.current,
  })

  latest.current = { onBest, onQuit }

  useEffect(() => {
    covered.current = held
    resync.current()
  }, [held])
  saved.current = Math.max(saved.current, best)

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
    let last = performance.now()

    const resize = (): void => {
      const dpr = window.devicePixelRatio || 1

      size = { width: element.clientWidth, height: element.clientHeight }
      surface.width = Math.round(size.width * dpr)
      surface.height = Math.round(size.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      colors = readColors(element)
    }

    const sync = (): void => {
      const current = game.current

      setHud((shown) =>
        shown.score === current.score &&
        shown.lives === current.lives &&
        shown.over === (current.phase === 'over') &&
        shown.paused === paused.current
          ? shown
          : {
              score: current.score,
              lives: current.lives,
              over: current.phase === 'over',
              paused: paused.current,
            },
      )
    }

    const tick = (now: number): void => {
      const dt = (now - last) / 1000

      last = now

      if (!paused.current) {
        const before = game.current

        game.current = step(before, dt, Math.random)

        if (before.phase === 'playing' && game.current.phase === 'over') {
          keepBest(game.current.score)
        }
      }

      drawGame(ctx, game.current, size, colors)
      sync()
      frame = requestAnimationFrame(tick)
    }

    // Space is the game's while it runs, from the bare page or from the game
    // itself; a field or a button that has focus keeps its own Space.
    const onKey = (event: KeyboardEvent): void => {
      const focused = document.activeElement
      const ours = focused === null || focused === document.body || element.contains(focused)

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

      game.current = pressSpace(game.current, event.repeat)
      sync()
    }

    // In another app nobody is watching the core, so nothing may reach it.
    const settle = (): void => {
      const was = paused.current

      paused.current = blurred.current || covered.current

      if (was && !paused.current) {
        last = performance.now()
      }

      sync()
    }

    resync.current = settle

    const onBlur = (): void => {
      blurred.current = true
      settle()
    }

    const onFocus = (): void => {
      blurred.current = false
      settle()
    }

    const resizes = new ResizeObserver(resize)
    // A theme switch changes the tokens without changing the size.
    const themed = element.closest('[data-app]')
    const themes = new MutationObserver(() => {
      colors = readColors(element)
    })

    resize()
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
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      resizes.disconnect()
      themes.disconnect()
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      keepBest(game.current.score)
    }
    // Once per game: everything that changes is read through refs.
  }, [])

  return (
    <div className="sonar-ping" ref={wrapper} tabIndex={-1}>
      <canvas className="sonar-ping__canvas" ref={canvas} />

      <div className="sonar-ping__hud">
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
