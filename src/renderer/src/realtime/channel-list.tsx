import { useState } from 'react'
import { channelKind } from '../../../shared/realtime'
import { StrokeIcon } from '../chrome/module-icons'
import { ConnectionCard } from './connection-card'
import { REALTIME_ICONS } from './icons'
import type { RealtimeState } from './use-realtime'

export function ChannelList({ realtime }: { realtime: RealtimeState }) {
  const [draft, setDraft] = useState('')

  const add = (): void => {
    realtime.subscribe(draft)
    setDraft('')
  }

  return (
    <aside className="realtime__aside">
      {/* Transport and connection are one block the canvas rules off from the
          channel list below it. */}
      <div className="realtime__head">
        <div className="realtime__tabs">
          <button
            className={`realtime__tab${realtime.transport === 'pusher' ? ' realtime__tab--on' : ''}`}
            onClick={() => realtime.setTransport('pusher')}
            type="button"
          >
            Pusher
            <span className="realtime__tab-count">{realtime.messages.length}</span>
          </button>
          <button
            className="realtime__tab realtime__tab--soon"
            disabled
            title="MQTT is not wired up yet"
            type="button"
          >
            MQTT
            <span className="realtime__tab-soon">soon</span>
          </button>
        </div>

        <ConnectionCard realtime={realtime} />
      </div>

      <div className="realtime__list-title">
        Channels
        <label className="realtime__follow" title="Subscribe to every channel the application is using">
          <input
            checked={realtime.follow}
            onChange={(event) => realtime.setFollow(event.target.checked)}
            type="checkbox"
          />
          Follow
        </label>
      </div>

      {realtime.followError === null ? null : (
        <p className="realtime__follow-error">{realtime.followError}</p>
      )}

      <div className="realtime__channels">
        {realtime.channels.length === 0 ? (
          <p className="realtime__none">
            {realtime.follow
              ? 'Nothing is listening yet. Open the application in a browser and its channels appear here.'
              : 'Nothing subscribed yet. Turn on Follow, or add a channel below.'}
          </p>
        ) : null}

        {realtime.channels.map((channel) => {
          const kind = channelKind(channel.name)
          const count = realtime.messages.filter((one) => one.channel === channel.name).length

          return (
            <div
              className={`realtime__channel${channel.muted ? ' realtime__channel--muted' : ''}`}
              key={channel.id}
            >
              <div className="realtime__channel-row">
                <span className="realtime__swatch" style={{ background: channel.color }} />

                <div className="realtime__channel-text">
                  <div className="realtime__channel-name" title={channel.name}>
                    {channel.name}
                  </div>
                  <div className="realtime__channel-meta">
                    <span className={`realtime__kind realtime__kind--${channel.refused === null ? kind : 'refused'}`}>
                      {channel.refused === null ? kind : 'refused'}
                    </span>
                    <span>
                      {channel.muted ? 'muted · ' : ''}
                      {count} message{count === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>

                <button
                  className="realtime__icon"
                  onClick={() => realtime.toggleMute(channel.name)}
                  title={channel.muted ? 'Show messages' : 'Hide messages'}
                  type="button"
                >
                  <StrokeIcon
                    path={channel.muted ? REALTIME_ICONS.eyeOff : REALTIME_ICONS.eye}
                    size={14}
                  />
                </button>

                <button
                  className="realtime__icon realtime__icon--drop"
                  onClick={() => realtime.unsubscribe(channel.name)}
                  title="Unsubscribe"
                  type="button"
                >
                  <StrokeIcon path={REALTIME_ICONS.close} size={12} />
                </button>
              </div>

              {channel.refused === null ? null : (
                <div className="realtime__refused">{channel.refused}</div>
              )}

              {channel.members.length === 0 ? null : (
                <div className="realtime__members">
                  {channel.members.map((member) => (
                    <div className="realtime__member" key={member.id}>
                      <span className="realtime__initials">{initials(member.name)}</span>
                      <span className="realtime__member-name">{member.name}</span>
                      {member.me ? <span className="realtime__you">you</span> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="realtime__add">
        <div className="realtime__add-row">
          <input
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                add()
              }
            }}
            placeholder={`private-${'{tenant}'}.user.1`}
            spellCheck={false}
            value={draft}
          />
          <button onClick={add} type="button">
            Subscribe
          </button>
        </div>
        <div className="realtime__add-hint">
          Prefix <code>private-</code> or <code>presence-</code> for channels the application has to
          authorize.
        </div>
      </div>
    </aside>
  )
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter((word) => /^[\p{Lu}]/u.test(word))
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
}
