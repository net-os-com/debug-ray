import type { HttpRequest, KeyValue } from './types'

/**
 * The response half of the exchange. The request's own headers, query string
 * and Context sit on the Route tab, where they were asked for, so they are not
 * repeated here.
 */
export function RequestTab({ request }: { request: HttpRequest }) {
  const cards: { title: string; rows: KeyValue[] }[] = [
    { title: 'Response headers', rows: request.responseHeaders },
    { title: 'Session', rows: request.session },
    { title: 'Authenticated user', rows: request.auth },
  ].filter((card) => card.rows.length > 0)

  const body = formatJson(request.responseBody)

  if (cards.length === 0 && body === null) {
    return (
      <div className="tab-pane">
        <div className="pane__none">Nothing was recorded about this response.</div>
      </div>
    )
  }

  return (
    <div className="tab-pane card-wall">
      {cards.map((card) => (
        <div className="card" key={card.title}>
          <div className="card__title">{card.title}</div>
          {card.rows.map((row) => (
            <div className="pair-row" key={row.key}>
              <span className="pair-row__key">{row.key}</span>
              <span className="pair-row__value">{row.value}</span>
            </div>
          ))}
        </div>
      ))}

      {body === null ? null : (
        <div className="card">
          <div className="card__title">Response body</div>
          <pre className="json-block">{body}</pre>
        </div>
      )}
    </div>
  )
}

/** Pretty-printed when it parses, left alone when it does not. */
function formatJson(body: string | null): string | null {
  if (body === null) {
    return null
  }

  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}
