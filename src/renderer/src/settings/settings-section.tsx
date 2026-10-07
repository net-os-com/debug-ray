import type { ReactNode } from 'react'

type SettingsSectionProps = {
  title: string
  children: ReactNode
}

/**
 * The settings used to be one flat card. They outgrew that, so each group gets
 * a heading — the list is scanned far more often than it is changed.
 */
export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <section className="settings__section">
      <h2 className="settings__section-title">{title}</h2>
      <div className="card card--rows">{children}</div>
    </section>
  )
}
