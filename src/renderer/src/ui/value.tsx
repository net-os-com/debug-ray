import { RawHtml } from './raw-html'
import { isVarDump } from './sf-dump'
import { VarDump } from './var-dump'

const HTML_TAG = /<[a-z][\s\S]*>/i

type ValueProps = {
  value: unknown
  /** Payloads that legitimately carry markup (table, custom) opt in. */
  allowHtml?: boolean
}

export function RayValue({ value, allowHtml = false }: ValueProps) {
  if (value === null || value === undefined) {
    return <span className="value-const">null</span>
  }

  if (typeof value === 'boolean') {
    return <span className="value-const">{value ? 'true' : 'false'}</span>
  }

  if (typeof value === 'number') {
    return <span className="value-num">{value}</span>
  }

  if (typeof value === 'string') {
    if (isVarDump(value)) {
      return <VarDump html={value} />
    }

    if (allowHtml && HTML_TAG.test(value)) {
      return <RawHtml html={value} />
    }

    return <span className="value-str">{value}</span>
  }

  return <pre className="value-json">{JSON.stringify(value, null, 2)}</pre>
}
