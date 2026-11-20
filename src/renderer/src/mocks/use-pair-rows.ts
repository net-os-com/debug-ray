import { useState } from 'react'
import type { ApiPair } from '../../../shared/api'

function toPairs(record: Record<string, string>): ApiPair[] {
  return Object.entries(record).map(([key, value]) => ({ key, value, enabled: true }))
}

function toRecord(pairs: ApiPair[]): Record<string, string> {
  return Object.fromEntries(
    pairs.filter((one) => one.enabled && one.key.trim() !== '').map((one) => [one.key, one.value]),
  )
}

/**
 * Rows for a record that cannot hold what a row can: a blank key, a switched
 * off row. The rows are kept here while the record follows them, and are
 * rebuilt from the record when it changes some other way (a discard) or when
 * `resetKey` says it is a different record.
 */
export function usePairRows(
  record: Record<string, string>,
  resetKey: string,
  onChange: (record: Record<string, string>) => void,
): [ApiPair[], (pairs: ApiPair[]) => void] {
  const serial = JSON.stringify(record)
  const [rows, setRows] = useState(() => toPairs(record))
  const [seen, setSeen] = useState({ serial, resetKey })

  if (seen.serial !== serial || seen.resetKey !== resetKey) {
    setSeen({ serial, resetKey })

    if (seen.resetKey !== resetKey || JSON.stringify(toRecord(rows)) !== serial) {
      setRows(toPairs(record))
    }
  }

  return [
    rows,
    (pairs) => {
      setRows(pairs)
      onChange(toRecord(pairs))
    },
  ]
}
