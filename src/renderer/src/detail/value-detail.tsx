import { RawHtml } from '../ui/raw-html'
import { isVarDump } from '../ui/sf-dump'
import { DumpDetail } from './dump-detail'
import { TextDetail } from './text-detail'

const HTML_TAG = /<[a-z][\s\S]*>/i

type ValueDetailProps = {
  value: unknown
  /** Payloads that legitimately carry markup (custom, table cells). */
  allowHtml?: boolean
}

export function ValueDetail({ value, allowHtml = false }: ValueDetailProps) {
  if (value === null || value === undefined) {
    return <TextDetail text="null" />
  }

  if (typeof value === 'boolean' || typeof value === 'number') {
    return <TextDetail text={String(value)} />
  }

  if (typeof value === 'string') {
    if (isVarDump(value)) {
      return <DumpDetail html={value} />
    }

    if (allowHtml && HTML_TAG.test(value)) {
      return (
        <div className="detail-card">
          <RawHtml html={value} />
        </div>
      )
    }

    return <TextDetail text={value} />
  }

  return <TextDetail text={JSON.stringify(value, null, 2)} />
}
