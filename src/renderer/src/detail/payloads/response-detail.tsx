import { FieldsDetail } from '../fields-detail'
import { CodeBlock } from './code-block'
import { JsonTree } from './json-tree'

/**
 * `ray()->showResponse()` — a whole HTTP response, which is a status line, a
 * header block and a body, not one object.
 */
export function ResponseDetail({ content }: { content: Record<string, unknown> }) {
  const status = Number(content.status_code)
  const body = typeof content.content === 'string' ? content.content : ''
  const json = content.json

  return (
    <div className="detail-stack">
      <div className="response-detail__status">
        <span
          className="response-detail__code"
          style={{ color: status >= 400 ? 'var(--err-fg)' : 'var(--ok-fg)' }}
        >
          {Number.isFinite(status) ? status : '—'}
        </span>
        <span className="response-detail__phrase">{phrase(status)}</span>
      </div>

      <FieldsDetail fields={{ Headers: content.headers }} />

      {json === null || json === undefined ? null : (
        <>
          <div className="detail-heading">JSON</div>
          <JsonTree value={json} />
        </>
      )}

      {body === '' ? null : (
        <>
          <div className="detail-heading">Body</div>
          <CodeBlock code={body} language={/^\s*</.test(body) ? 'markup' : null} />
        </>
      )}
    </div>
  )
}

const PHRASES: [number, string][] = [
  [200, 'OK'],
  [201, 'Created'],
  [204, 'No content'],
  [301, 'Moved permanently'],
  [302, 'Found'],
  [304, 'Not modified'],
  [400, 'Bad request'],
  [401, 'Unauthorised'],
  [403, 'Forbidden'],
  [404, 'Not found'],
  [409, 'Conflict'],
  [419, 'Page expired'],
  [422, 'Unprocessable content'],
  [429, 'Too many requests'],
  [500, 'Server error'],
  [503, 'Service unavailable'],
]

function phrase(status: number): string {
  return PHRASES.find(([code]) => code === status)?.[1] ?? ''
}
