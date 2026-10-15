import { useState } from 'react'
import { SettingsToggle } from './settings-toggle'

type SettingsNotificationsProps = {
  on: boolean
  onToggle: () => void
}

/**
 * The notifications switch, which checks itself when you turn it on.
 *
 * macOS refuses every notification from an app it has not been asked about,
 * and refuses silently: `notification.show()` returns, nothing appears, and
 * the only trace is a `failed` event the main process logged to a console a
 * packaged app has no window for. So the switch posts one banner itself and
 * reports what came back. The person is looking at this row at that moment,
 * which is the one moment the answer is worth anything.
 */
export function SettingsNotifications({ on, onToggle }: SettingsNotificationsProps) {
  const [refused, setRefused] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  return (
    <>
      <SettingsToggle
        hint="Post a macOS notification when an event arrives while the window is in the background."
        label="Show notifications"
        on={on}
        onToggle={() => {
          onToggle()
          setRefused(null)

          if (on) {
            return
          }

          setChecking(true)
          void window.ray
            .testNotification()
            .then((result) => setRefused(result.ok ? null : result.error))
            .finally(() => setChecking(false))
        }}
      />

      {checking ? <div className="settings__note">Sending a test notification…</div> : null}

      {refused === null ? null : (
        <div className="settings__note settings__note--bad">
          macOS would not show it. Allow NetOS Debug under System Settings → Notifications, then
          switch this off and on again.
          <span className="settings__note-detail">{refused}</span>
        </div>
      )}
    </>
  )
}
