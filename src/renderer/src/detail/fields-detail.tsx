import { ValueDetail } from './value-detail'

/** The design's two-column table, used for every key/value shaped payload. */
export function FieldsDetail({ fields }: { fields: Record<string, unknown> }) {
  const rows = Object.entries(fields).filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  )

  if (rows.length === 0) {
    return null
  }

  return (
    <div className="detail-table">
      <div className="detail-table__head">
        <div>Field</div>
        <div>Value</div>
      </div>
      {rows.map(([key, value]) => (
        <div className="detail-table__row" key={key}>
          <div className="detail-table__key">{key}</div>
          <div className="detail-table__cell">
            <ValueDetail allowHtml value={value} />
          </div>
        </div>
      ))}
    </div>
  )
}
