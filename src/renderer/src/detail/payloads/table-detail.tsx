import { FieldsDetail } from '../fields-detail'
import { tableKind } from './custom-kind'
import { toPlainText } from '../../ui/plain-text'

/**
 * `table()`, `phpinfo()`, `showCache()` and `env()` all send a `table` payload
 * and name themselves in the label, which until now was dropped — so a cache
 * write and a PHP configuration dump arrived looking identical.
 */
export function TableDetail({ content }: { content: Record<string, unknown> }) {
  const label = typeof content.label === 'string' ? content.label : ''
  const values = isRecord(content.values) ? content.values : {}
  const kind = tableKind(label)

  if (kind === 'phpinfo') {
    return <PhpInfoDetail values={values} />
  }

  return (
    <div className="detail-stack">
      {label === '' || label === 'Table' ? null : <div className="detail-heading">{label}</div>}
      <FieldsDetail fields={values} />
    </div>
  )
}

/**
 * phpinfo() puts every loaded extension in one comma-separated string, which in
 * a two-column table is a paragraph six lines deep that you have to read to
 * answer "is redis in there".
 */
function PhpInfoDetail({ values }: { values: Record<string, unknown> }) {
  const { Extensions: extensions, ...rest } = values
  const names = typeof extensions === 'string'
    ? toPlainText(extensions)
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name !== '')
    : []

  return (
    <div className="detail-stack">
      <div className="detail-heading">PHP</div>
      <FieldsDetail fields={rest} />

      {names.length === 0 ? null : (
        <>
          <div className="detail-heading">{names.length} extensions</div>
          <div className="chips">
            {names.map((name) => (
              <span className="chips__one" key={name}>
                {name}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
