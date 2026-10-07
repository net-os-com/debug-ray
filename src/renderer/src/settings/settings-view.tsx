import type { ServerStatus } from '../../../shared/ray-event'
import type { EditorChoice, Settings, StartView } from '../use-settings'
import { ClientsCard } from './clients-card'
import { McpCard } from './mcp-card'
import { SettingsList } from './settings-list'
import { SettingsNumber } from './settings-number'
import { SettingsSection } from './settings-section'
import { SettingsSelect } from './settings-select'
import { SettingsText } from './settings-text'
import { SettingsToggle } from './settings-toggle'

const VIEWS: { value: StartView; label: string }[] = [
  { value: 'stream', label: 'Stream' },
  { value: 'requests', label: 'Requests' },
]

const EDITORS: { value: EditorChoice; label: string }[] = [
  { value: 'none', label: 'Do not open' },
  { value: 'phpstorm', label: 'PhpStorm' },
  { value: 'vscode', label: 'VS Code' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'sublime', label: 'Sublime Text' },
]

type SettingsViewProps = {
  settings: Settings
  status: ServerStatus | null
  onSet: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  onToggle: (key: keyof Settings) => void
  onClose: () => void
}

export function SettingsView({ settings, status, onSet, onToggle, onClose }: SettingsViewProps) {
  return (
    <div className="settings">
      <div className="settings__inner">
        <div className="settings__head">
          <div>
            <div className="settings__title">Settings</div>
            <div className="settings__subtitle">Applies to this machine only.</div>
          </div>
          <button className="button" onClick={onClose} type="button">
            Back to stream
          </button>
        </div>

        <SettingsSection title="Window">
          <SettingsToggle
            hint="Float the window above other applications."
            label="Keep on top"
            on={settings.alwaysOnTop}
            onToggle={() => onToggle('alwaysOnTop')}
          />
          <SettingsToggle
            hint="Start NetOS Debug when you log in, so it is already listening."
            label="Launch at login"
            on={settings.launchAtLogin}
            onToggle={() => onToggle('launchAtLogin')}
          />
          <SettingsToggle
            hint="Closing the window hides it and keeps the receiver running, instead of quitting."
            label="Close to background"
            on={settings.closeToBackground}
            onToggle={() => onToggle('closeToBackground')}
          />
          <SettingsSelect
            hint="Which view opens when the app starts."
            label="Default view"
            onChange={(value) => onSet('defaultView', value)}
            options={VIEWS}
            value={settings.defaultView}
          />
        </SettingsSection>

        <SettingsSection title="Stream">
          <SettingsToggle
            hint="Jump back to the newest event as it arrives."
            label="Follow new events"
            on={settings.autoscroll}
            onToggle={() => onToggle('autoscroll')}
          />
          <SettingsToggle
            hint="Skip framework and vendor frames in stack traces."
            label="Hide vendor frames"
            on={settings.hideVendorFrames}
            onToggle={() => onToggle('hideVendorFrames')}
          />
          <SettingsToggle
            hint="Show how long ago an event arrived rather than the clock time."
            label="Relative timestamps"
            on={settings.relativeTime}
            onToggle={() => onToggle('relativeTime')}
          />
          <SettingsNumber
            hint="How many events are kept before the oldest are dropped."
            label="Event buffer"
            max={5_000}
            min={50}
            onChange={(value) => onSet('eventBuffer', value)}
            step={50}
            unit="events"
            value={settings.eventBuffer}
          />
        </SettingsSection>

        <SettingsSection title="Requests">
          <SettingsToggle
            hint="Keep collecting requests from the Laravel middleware. Turning this off drops them on arrival."
            label="Collect requests"
            on={settings.collectRequests}
            onToggle={() => onToggle('collectRequests')}
          />
          <SettingsToggle
            hint="Skip queries whose source sits in vendor, the way stack traces do."
            label="Hide vendor queries"
            on={settings.hideVendorQueries}
            onToggle={() => onToggle('hideVendorQueries')}
          />
          <SettingsNumber
            hint="A request slower than this is flagged, and matches the Slow filter."
            label="Slow request"
            max={10_000}
            min={10}
            onChange={(value) => onSet('slowRequestMs', value)}
            step={10}
            unit="ms"
            value={settings.slowRequestMs}
          />
          <SettingsNumber
            hint="A query slower than this is flagged in the query list."
            label="Slow query"
            max={5_000}
            min={1}
            onChange={(value) => onSet('slowQueryMs', value)}
            step={5}
            unit="ms"
            value={settings.slowQueryMs}
          />
          <SettingsNumber
            hint="How many collected requests are kept. One request weighs far more than one event."
            label="Request buffer"
            max={1_000}
            min={10}
            onChange={(value) => onSet('requestBuffer', value)}
            step={10}
            unit="requests"
            value={settings.requestBuffer}
          />
        </SettingsSection>

        <SettingsSection title="Notifications">
          <SettingsToggle
            hint="Bring the window forward when an exception arrives."
            label="Focus on errors"
            on={settings.notifyOnError}
            onToggle={() => onToggle('notifyOnError')}
          />
          <SettingsToggle
            hint="Post a macOS notification when an event arrives while the window is in the background."
            label="Show notifications"
            on={settings.notifyOnEvent}
            onToggle={() => onToggle('notifyOnEvent')}
          />
          <SettingsToggle
            hint="Play the system sound with each notification."
            label="Notification sound"
            on={settings.notificationSound}
            onToggle={() => onToggle('notificationSound')}
          />
          <SettingsNumber
            hint="Events arriving within this window after a notification are summarised into one instead of each getting a banner."
            label="Group bursts for"
            max={30_000}
            min={0}
            onChange={(value) => onSet('notificationCoalesceMs', value)}
            step={500}
            unit="ms"
            value={settings.notificationCoalesceMs}
          />
        </SettingsSection>

        <SettingsSection title="Sources">
          <SettingsList
            hint="One per line. Payloads whose hostname or file path contains an entry are dropped on arrival, which keeps another project sharing this port out of your stream."
            label="Ignore"
            onChange={(value) => onSet('ignoredSources', value)}
            placeholder={'Rick-Macbook.local\n/some/other/project'}
            value={settings.ignoredSources}
          />
        </SettingsSection>

        <SettingsSection title="Editor">
          <SettingsSelect
            hint="Clicking a file and line in a stack trace opens it here."
            label="Open files in"
            onChange={(value) => onSet('editor', value)}
            options={EDITORS}
            value={settings.editor}
          />
          <SettingsText
            hint="The project root as the sender sees it. Leave both empty when the sender runs on this machine."
            label="Remote path"
            onChange={(value) => onSet('remotePath', value)}
            placeholder="/var/www/html"
            value={settings.remotePath}
          />
          <SettingsText
            hint="Where that same project sits here, so a path from a container becomes one you can open."
            label="Local path"
            onChange={(value) => onSet('localPath', value)}
            placeholder="/Users/you/Code/project"
            value={settings.localPath}
          />
        </SettingsSection>

        <SettingsSection title="Server">
          <div className="setting setting--last">
            <div className="setting__text">
              <div className="setting__label">Listening address</div>
              <div className="setting__hint">
                Set RAY_HOST or RAY_PORT and restart the app to change this.
              </div>
            </div>
            <div className="setting__value">
              {status ? `${status.host}:${status.port}` : '—'}
            </div>
          </div>
        </SettingsSection>

        <McpCard />

        <ClientsCard />
      </div>
    </div>
  )
}
