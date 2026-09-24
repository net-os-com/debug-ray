import { tableOf } from './sql-tokens'
import { worstRepeat, type HttpRequest } from './types'

type BannerProps = {
  request: HttpRequest
  onShowDuplicates: () => void
}

/** Derived from the actual repeats rather than a flag on the request. */
export function NPlusOneBanner({ request, onShowDuplicates }: BannerProps) {
  const worst = worstRepeat(request)

  if (!worst) {
    return null
  }

  const file = worst.query.source.split(':')[0].replace('.php', '')
  const table = tableOf(worst.query.sql)

  return (
    <div className="n1-banner">
      <svg
        fill="none"
        height="20"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
        width="20"
      >
        <path d="M12 9v3.75m0 3.5h.01M10.34 3.94 2.7 17.1A1.9 1.9 0 0 0 4.35 20h15.3a1.9 1.9 0 0 0 1.65-2.9L13.66 3.94a1.9 1.9 0 0 0-3.32 0Z" />
      </svg>
      <div className="n1-banner__body">
        <div className="n1-banner__title">Possible N+1 in {file}</div>
        <div>
          The same query{table ? <> on <code>{table}</code></> : null} ran {worst.count} times from{' '}
          <code>{worst.query.source}</code>. Eager load the relation instead.
        </div>
      </div>
      <button className="n1-banner__action" onClick={onShowDuplicates} type="button">
        Show duplicates
      </button>
    </div>
  )
}
