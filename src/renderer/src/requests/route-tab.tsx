import type { ReactNode } from 'react'
import type { HttpRequest, KeyValue, RouteInfo } from './types'

export function RouteTab({ request }: { request: HttpRequest }) {
  const route = request.route

  const cards: { title: string; body: ReactNode }[] = [
    ...(route === null ? [] : cardsForRoute(route)),
    ...pairCard('Query parameters', request.queryParameters),
    ...pairCard('Request headers', request.headers),
    ...pairCard('Context', request.context),
  ]

  // A 404 still has headers worth reading, so the cards stay and the missing
  // route is stated rather than left as an absence.
  const unmatched = route === null ? <div className="route__none">This request matched no route.</div> : null

  if (cards.length === 0) {
    return <div className="route-tab">{unmatched}</div>
  }

  return (
    <div className="route-tab">
      {unmatched}
      <div className="card-wall">
        {cards.map((card) => (
          <div className="card" key={card.title}>
            <div className="card__title">{card.title}</div>
            {card.body}
          </div>
        ))}
      </div>
    </div>
  )
}

function cardsForRoute(route: RouteInfo): { title: string; body: ReactNode }[] {
  const rows = rowsOf(route)

  return [
    ...(rows.length === 0
      ? []
      : [
          {
            title: 'Route',
            body: rows.map((row) => (
              <div className="route-row" key={row.key}>
                <span className="route-row__key">{row.key}</span>
                <span className="route-row__value">{row.value}</span>
              </div>
            )),
          },
        ]),
    ...(route.middleware.length === 0
      ? []
      : [
          {
            title: 'Middleware stack',
            body: route.middleware.map((entry, index) => (
              <div className="middleware-row" key={`${entry.name}-${index}`}>
                <span className="middleware-row__n">{index + 1}</span>
                <div className="middleware-row__body">
                  <div className="middleware-row__name">{entry.name}</div>
                  <div className="middleware-row__class" title={entry.class ?? ''}>
                    {entry.class ?? '—'}
                  </div>
                </div>
              </div>
            )),
          },
        ]),
  ]
}

/** A card with no rows is dropped rather than shown as a bare heading. */
function pairCard(title: string, rows: KeyValue[]): { title: string; body: ReactNode }[] {
  if (rows.length === 0) {
    return []
  }

  return [
    {
      title,
      body: rows.map((row) => (
        <div className="pair-row" key={row.key}>
          <span className="pair-row__key">{row.key}</span>
          <span className="pair-row__value">{row.value}</span>
        </div>
      )),
    },
  ]
}

/** Rows with nothing behind them are left out rather than shown as a dash. */
function rowsOf(route: RouteInfo): KeyValue[] {
  const parameters = route.parameters.map((entry) => `${entry.key} = ${entry.value}`).join(', ')

  return [
    { key: 'URI', value: route.uri ?? '' },
    { key: 'Methods', value: route.methods.join(', ') },
    { key: 'Name', value: route.name ?? '' },
    { key: 'Action', value: route.action ?? '' },
    { key: 'File', value: route.file ?? '' },
    { key: 'Prefix', value: route.prefix ?? '' },
    { key: 'Domain', value: route.domain ?? '' },
    { key: 'Parameters', value: parameters },
    { key: 'Throttle', value: route.throttle ?? '' },
  ].filter((row) => row.value !== '')
}
