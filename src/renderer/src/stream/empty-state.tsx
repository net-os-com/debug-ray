import { useEffect, useRef, useState } from 'react'
import { SonarPing } from './sonar-ping/sonar-ping'
import { useSpaceToPlay } from './sonar-ping/use-space-to-play'
import { Sonar } from './sonar'
import { breathSeconds, waitingMessage } from './waiting'

const SNIPPET = `ray('Dashboard mounted');
ray($user)->label('auth');
ray()->measure();
ray()->confetti();`

/** Often enough for the wait to notice itself, rarely enough to cost nothing. */
const TICK_MS = 30_000

type EmptyStateProps = {
  target: string
  /** The hidden game's best score, kept in settings. */
  best: number
  onBest: (score: number) => void
}

/**
 * The stream before anything arrived. Space on the bare page turns the sonar
 * into a small game — unannounced, for whoever finds it. The first event
 * unmounts this screen, and the game with it.
 */
export function EmptyState({ target, best, onBest }: EmptyStateProps) {
  const elapsed = useWaited()
  const message = waitingMessage(elapsed)
  const [playing, setPlaying] = useState(false)

  useSpaceToPlay(() => setPlaying(true))

  if (playing) {
    return (
      <div className="empty empty--playing">
        <SonarPing best={best} onBest={onBest} onQuit={() => setPlaying(false)} />
      </div>
    )
  }

  return (
    <div className="empty">
      <div className="empty__inner">
        <Sonar seconds={breathSeconds(elapsed)} />
        <div className="empty__title">{message.title}</div>
        <div className="empty__body">{message.body}</div>
        <pre className="empty__snippet">{SNIPPET}</pre>
        <div className="empty__target">{target}</div>
      </div>
    </div>
  )
}

/** Milliseconds this screen has been the one you are looking at. */
function useWaited(): number {
  const since = useRef(Date.now())
  const [, tick] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => tick((count) => count + 1), TICK_MS)

    return () => clearInterval(timer)
  }, [])

  return Date.now() - since.current
}
