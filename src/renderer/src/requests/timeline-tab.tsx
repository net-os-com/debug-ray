import { formatDuration } from '../duration'
import { legendOf, spansOf, ticksOf, TIMELINE_COLORS } from './timeline-model'
import type { HttpRequest } from './types'

export function TimelineTab({ request }: { request: HttpRequest }) {
  const spans = spansOf(request)

  if (spans.length === 0) {
    return (
      <div className="timeline-tab">
        <div className="timeline__none">
          No timeline was collected for this request. A collector only
          contributes spans when its own <code>timeline</code> option is on.
        </div>
      </div>
    )
  }

  const ticks = ticksOf(request.durationMs)
  const legend = legendOf(spans)

  return (
    <div className="timeline-tab">
      <div className="timeline">
        <div className="timeline__inner">
          <div className="timeline__head">
            <div className="timeline__phase-label">Phase</div>
            <div className="timeline__axis">
              {ticks.map((tick) => (
                <span className="timeline__tick" key={tick.at} style={{ left: tick.left }}>
                  {formatDuration(tick.at)}
                </span>
              ))}
            </div>
          </div>

          {spans.map((span, index) => (
            <div className="timeline__row" key={`${span.label}-${index}`}>
              <div
                className="timeline__meta"
                style={{ paddingLeft: `${span.depth * 18}px` }}
              >
                <span
                  className="timeline__dot"
                  style={{ background: TIMELINE_COLORS[span.band].color }}
                />
                <span
                  className="timeline__label"
                  style={{ fontWeight: span.depth === 0 ? 500 : 400 }}
                  title={span.label}
                >
                  {span.label}
                </span>
                <span className="timeline__duration">{formatDuration(span.durationMs)}</span>
              </div>

              <div className="timeline__track">
                <div
                  className="timeline__bar"
                  style={{
                    left: span.left,
                    width: span.width,
                    background: TIMELINE_COLORS[span.band].color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="timeline__legend">
        {legend.map((entry) => (
          <span className="timeline__legend-item" key={entry.band}>
            <span className="timeline__dot" style={{ background: entry.color }} />
            {entry.label}
          </span>
        ))}
      </div>
    </div>
  )
}
