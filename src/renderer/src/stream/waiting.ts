export type Waiting = {
  title: string
  body: string
}

/**
 * How the empty screen passes the time.
 *
 * Nothing here changes what the app is doing — it is still listening, and the
 * address below says so. The wait simply stops pretending to be a fresh start
 * after the tenth minute of the same screen.
 */
const STAGES: { after: number; waiting: Waiting }[] = [
  {
    after: 0,
    waiting: {
      title: 'Waiting for events',
      body: 'Nothing has come in yet. Send something from your app and it shows up here.',
    },
  },
  {
    after: 5 * 60_000,
    waiting: {
      title: 'Still waiting',
      body: 'Five quiet minutes. Is the container actually running?',
    },
  },
  {
    after: 15 * 60_000,
    waiting: {
      title: 'Nothing yet',
      body: 'Worth checking that ray.php points at this machine and this port.',
    },
  },
  {
    after: 30 * 60_000,
    waiting: {
      title: "I'll wait",
      body: 'Half an hour. The port is still open and the buffer is still empty.',
    },
  },
  {
    after: 60 * 60_000,
    waiting: {
      title: 'Take your time',
      body: 'We could talk about the weather. Or you could hit an endpoint.',
    },
  },
]

export function waitingMessage(elapsedMs: number): Waiting {
  let found = STAGES[0] as { after: number; waiting: Waiting }

  for (const stage of STAGES) {
    if (elapsedMs >= stage.after) {
      found = stage
    }
  }

  return found.waiting
}

/** How long the drawing takes for one breath, slowing as the wait drags on. */
export function breathSeconds(elapsedMs: number): number {
  if (elapsedMs >= 30 * 60_000) {
    return 9
  }

  return elapsedMs >= 5 * 60_000 ? 6 : 4
}
