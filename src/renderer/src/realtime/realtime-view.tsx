import { StrokeIcon } from '../chrome/module-icons'
import { ChannelList } from './channel-list'
import { Composer } from './composer'
import { REALTIME_ICONS } from './icons'
import { MessageList } from './message-list'
import type { RealtimeState } from './use-realtime'

export function RealtimeView({ realtime }: { realtime: RealtimeState }) {
  return (
    <div className="realtime">
      <ChannelList realtime={realtime} />

      <section className="realtime__main">
        {/*
         * Two rows, as the canvas draws it. The chips were on the same line as
         * the search and the controls, which left them a few hundred pixels
         * that a single tenant-qualified channel name fills on its own. On
         * their own row they get the full width and scroll sideways.
         */}
        <div className="realtime__bar">
          <div className="realtime__bar-row">
            <div className="realtime__search">
              <StrokeIcon path={REALTIME_ICONS.search} size={15} />
              <input
                data-find="realtime"
                onChange={(event) => realtime.setQuery(event.target.value)}
                placeholder="Filter messages"
                value={realtime.query}
              />
            </div>

            <span className="realtime__shown">
              <span
                className={`realtime__pulse realtime__pulse--${realtime.paused ? 'paused' : 'live'}`}
              />
              {realtime.paused ? 'Paused · ' : ''}
              {realtime.shown.length} shown
            </span>

            <div className="realtime__controls">
              <button
                onClick={() => realtime.setPaused(!realtime.paused)}
                title={realtime.paused ? 'Resume' : 'Pause'}
                type="button"
              >
                <StrokeIcon
                  path={realtime.paused ? REALTIME_ICONS.play : REALTIME_ICONS.pause}
                  size={14}
                />
                {realtime.paused ? 'Resume' : 'Pause'}
              </button>
              <button onClick={realtime.clear} title="Clear messages" type="button">
                <StrokeIcon path={REALTIME_ICONS.trash} size={14} />
                Clear
              </button>
            </div>
          </div>

          <div className="realtime__chips">
            <Chip
              color="var(--t3)"
              count={realtime.messages.length}
              label="All"
              on={realtime.filter === 'all'}
              onSelect={() => realtime.setFilter('all')}
            />
            {realtime.channels.map((channel) => (
              <Chip
                color={channel.color}
                count={realtime.messages.filter((one) => one.channel === channel.name).length}
                key={channel.id}
                label={channel.name}
                on={realtime.filter === channel.name}
                onSelect={() => realtime.setFilter(channel.name)}
              />
            ))}
          </div>
        </div>

        <MessageList realtime={realtime} />

        <Composer realtime={realtime} />
      </section>

      {realtime.toast === '' ? null : <div className="realtime__toast">{realtime.toast}</div>}
    </div>
  )
}

function Chip({
  color,
  count,
  label,
  on,
  onSelect,
}: {
  color: string
  count: number
  label: string
  on: boolean
  onSelect: () => void
}) {
  return (
    <button
      className={`realtime__chip${on ? ' realtime__chip--on' : ''}`}
      onClick={onSelect}
      title={label}
      type="button"
    >
      <span className="realtime__swatch realtime__swatch--sm" style={{ background: color }} />
      <span className="realtime__chip-label">{label}</span>
      <span className="realtime__chip-count">{count}</span>
    </button>
  )
}
