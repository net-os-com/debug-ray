import { channelKind } from '../../../shared/realtime'
import { shortEvent } from './channels'
import type { RealtimeState } from './use-realtime'

export function Composer({ realtime }: { realtime: RealtimeState }) {
  const whisper = realtime.mode === 'whisper'
  const options = realtime.channels
    .filter((one) => !whisper || channelKind(one.name) !== 'public')
    .map((one) => one.name)

  return (
    <div className="realtime__composer">
      <div className="realtime__composer-head">
        <div className="realtime__modes">
          {(['broadcast', 'whisper'] as const).map((key) => (
            <button
              className={`realtime__mode${realtime.mode === key ? ' realtime__mode--on' : ''}`}
              key={key}
              onClick={() => realtime.setMode(key)}
              type="button"
            >
              {key === 'broadcast' ? 'Broadcast event' : 'Client event'}
            </button>
          ))}
        </div>

        {whisper ? (
          <div className="realtime__whisper">
            <span className="realtime__whisper-prefix">client-</span>
            <input
              onChange={(event) =>
                realtime.setWhisperName(event.target.value.replace(/^client-/, ''))
              }
              spellCheck={false}
              value={realtime.whisperName}
            />
          </div>
        ) : (
          <>
            <input
              className="realtime__event"
              list="realtime-events"
              onChange={(event) => realtime.setEvent(event.target.value)}
              placeholder="App\Events\…"
              spellCheck={false}
              value={realtime.event}
            />
            <datalist id="realtime-events">
              {realtime.events.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </>
        )}

        <select
          className="realtime__target"
          onChange={(event) => realtime.setTarget(event.target.value)}
          value={realtime.target}
        >
          {options.length === 0 ? <option value="">No channel to send on</option> : null}
          {options.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="realtime__payload">
        <textarea
          className={realtime.valid ? '' : 'realtime__payload--bad'}
          onChange={(event) => realtime.setPayload(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault()
              void realtime.send()
            }
          }}
          rows={4}
          spellCheck={false}
          value={realtime.payload}
        />

        <div className="realtime__send">
          <button
            disabled={!realtime.valid || realtime.sending}
            onClick={() => void realtime.send()}
            type="button"
          >
            {realtime.sending ? 'Sending…' : whisper ? 'Whisper' : 'Broadcast'}
          </button>
          <span className="realtime__shortcut">⌘ Enter</span>
        </div>
      </div>

      <div className="realtime__composer-foot">
        <span className={realtime.valid ? '' : 'realtime__bad'}>
          {!realtime.valid
            ? 'Invalid JSON'
            : whisper
              ? 'Client events are not delivered back to you'
              : 'Dispatched on the server:'}
        </span>

        {realtime.valid && !whisper ? (
          <code className="realtime__php">
            Broadcast::{prefixFor(realtime.target)}(&apos;{bare(realtime.target)}&apos;)-&gt;as(&apos;
            {shortEvent(realtime.event) || 'Event'}&apos;)-&gt;with([…])-&gt;sendNow()
          </code>
        ) : null}
      </div>
    </div>
  )
}

function prefixFor(channel: string): string {
  const kind = channelKind(channel)

  return kind === 'public' ? 'on' : kind
}

function bare(channel: string): string {
  return channel.replace(/^(private-|presence-)/, '')
}
