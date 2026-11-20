import { useState } from 'react'

type NumberFieldProps = {
  label: string
  value: number
  min: number
  max: number
  onCommit: (value: number) => void
}

function whole(text: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(text)) {
    return null
  }

  const number = Number(text)

  return number >= min && number <= max ? number : null
}

/** Holds what is typed; only a whole number in range reaches the draft. */
export function NumberField({ label, value, min, max, onCommit }: NumberFieldProps) {
  const [typed, setTyped] = useState<string | null>(null)

  const invalid = typed !== null && whole(typed, min, max) === null

  return (
    <input
      aria-invalid={invalid}
      aria-label={label}
      className={invalid ? 'mk-number mk-number--invalid' : 'mk-number'}
      inputMode="numeric"
      onBlur={() => setTyped(null)}
      onChange={(event) => {
        const text = event.target.value.trim()
        const next = whole(text, min, max)

        setTyped(text)

        if (next !== null) {
          onCommit(next)
        }
      }}
      title={invalid ? `A whole number from ${min} to ${max}` : undefined}
      value={typed ?? String(value)}
    />
  )
}
