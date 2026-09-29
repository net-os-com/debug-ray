import { useEffect, useRef, useState } from 'react'
import { Sonar } from './sonar'
import { breathSeconds, waitingMessage } from './waiting'

const SNIPPET = `ray('Dashboard mounted');
ray($user)->label('auth');
ray()->measure();
ray()->confetti();`

/** Often enough for the wait to notice itself, rarely enough to cost nothing. */
const TICK_MS = 30_000

export function EmptyState({ target }: { target: string }) {
  const elapsed = useWaited()
  const message = waitingMessage(elapsed)

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
