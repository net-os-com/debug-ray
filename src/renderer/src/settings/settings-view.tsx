import type { ServerStatus } from '../../../shared/ray-event'
import type { Settings } from '../use-settings'
import { ClientsCard } from './clients-card'
import { McpCard } from './mcp-card'
import { SettingsToggle } from './settings-toggle'

const DEFS: { key: keyof Settings; label: string; hint: string }[] = [
  {
    key: 'autoscroll',
    label: 'Follow new events',
    hint: 'Jump back to the newest event as it arrives.',
  },
  {
    key: 'hideVendorFrames',
    label: 'Hide vendor frames',
    hint: 'Skip framework and vendor frames in stack traces.',
  },
  {
    key: 'notifyOnError',
    label: 'Notify on errors',
    hint: 'Bring the window forward when an exception arrives.',
  },
]

type SettingsViewProps = {
  settings: Settings
  status: ServerStatus | null
  onToggle: (key: keyof Settings) => void
  onClose: () => void
}

export function SettingsView({ settings, status, onToggle, onClose }: SettingsViewProps) {
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

        <div className="card card--rows">
          {DEFS.map((def) => (
            <SettingsToggle
              hint={def.hint}
              key={def.key}
              label={def.label}
              on={settings[def.key]}
              onToggle={() => onToggle(def.key)}
            />
          ))}
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
        </div>

        <McpCard />

        <ClientsCard />
      </div>
    </div>
  )
}
