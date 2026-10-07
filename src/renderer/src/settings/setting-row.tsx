import type { ReactNode } from 'react'

type SettingRowProps = {
  label: string
  hint: string
  children: ReactNode
}

/** The label-and-hint half every setting shares, whatever its control is. */
export function SettingRow({ label, hint, children }: SettingRowProps) {
  return (
    <div className="setting">
      <div className="setting__text">
        <div className="setting__label">{label}</div>
        <div className="setting__hint">{hint}</div>
      </div>
      {children}
    </div>
  )
}
