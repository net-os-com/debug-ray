import { channelKind } from '../../../shared/realtime'
import { StrokeIcon } from '../chrome/module-icons'
import { REALTIME_ICONS } from './icons'
import { isSystemEvent, shortEvent, type RealtimeMessage } from './channels'
import { jsonRows } from './json-rows'
import type { RealtimeState } from './use-realtime'

export function MessageList({ realtime }: { realtime: RealtimeState }) {
  if (realtime.shown.length === 0) {
    return (
      <div className="realtime__stream">
        <div className="realtime__empty">
          <div className="realtime__empty-title">
            {realtime.messages.length === 0 ? 'No messages yet' : 'No messages match this filter'}
          </div>
          <div className="realtime__empty-sub">
            {realtime.messages.length === 0
              ? 'Events on your channels appear here.'
              : 'Pick another channel or clear the search.'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="realtime__stream" data-find="realtime">
      {realtime.shown.map((message) => (
        <MessageRow key={message.id} message={message} realtime={realtime} />
      ))}
    </div>
  )
}

function MessageRow({
  message,
  realtime,
}: {
  message: RealtimeMessage
  realtime: RealtimeState
}) {
  const open = realtime.openId === message.id
  const out = message.dir === 'out'
  const color =
    realtime.channels.find((one) => one.name === message.channel)?.color ?? 'var(--t3)'
  const preview = JSON.stringify(message.payload)
  const bytes = new Blob([preview]).size

  return (
    <div className={`realtime__msg${open ? ' realtime__msg--open' : ''}`}>
      <button
        className={`realtime__msg-row${out ? ' realtime__msg-row--out' : ''}`}
        onClick={() => realtime.setOpenId(open ? null : message.id)}
        type="button"
      >
        <span
          className={`realtime__dir realtime__dir--${out ? 'out' : 'in'}`}
          title={out ? 'Sent' : 'Received'}
        >
          <StrokeIcon path={out ? REALTIME_ICONS.out : REALTIME_ICONS.in} size={12} />
        </span>

        <span className="realtime__time">{clock(message.at)}</span>

        <span className="realtime__msg-text">
          <span className="realtime__msg-title" title={message.event}>
            <span
              className="realtime__swatch realtime__swatch--sm"
              style={{ background: out ? 'var(--app-accent-fg)' : color }}
            />
            {shortEvent(message.event)}
          </span>
          <span className="realtime__msg-channel">{message.channel}</span>
        </span>

        <span className="realtime__badges">
          {message.via === null ? null : (
            <span className="realtime__badge realtime__badge--via">{message.via}</span>
          )}
          {isSystemEvent(message.event) ? (
            <span className="realtime__badge">system</span>
          ) : null}
        </span>

        <span className="realtime__preview">{preview}</span>
      </button>

      {open ? (
        <div className="realtime__detail">
          <div className="realtime__json">
            {jsonRows(message.payload).map((row, index) => (
              <div className="realtime__json-row" key={index} style={{ paddingLeft: row.indent * 16 }}>
                {row.key === '' ? null : <span className="realtime__json-key">{row.key}</span>}
                <span className={`realtime__json-value realtime__json-value--${row.kind}`}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          <div className="realtime__detail-foot">
            <button onClick={() => realtime.reuse(message)} type="button">
              Use in composer
            </button>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(JSON.stringify(message.payload, null, 2))
                realtime.say('Payload copied.')
              }}
              type="button"
            >
              Copy payload
            </button>
            <span className="realtime__detail-meta">
              {out ? 'Sent' : 'Received'} · {bytes} bytes
              {message.channel === '' ? '' : ` · ${channelKind(message.channel)} channel`}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function clock(at: number): string {
  const date = new Date(at)
  const pad = (value: number, length = 2): string => String(value).padStart(length, '0')

  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
}
