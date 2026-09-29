import { useState } from 'react'
import { RawHtml } from '../../ui/raw-html'
import { CodeBlock } from './code-block'

/**
 * `ray()->html()` and `ray()->markdown()`: the markup, and the markup's source.
 *
 * Rendering is what was asked for, and it is also the one view in which a
 * missing closing tag is invisible, so the source is one click away rather than
 * a round trip through the app that sent it.
 */
export function HtmlDetail({ html, caption }: { html: string; caption: string }) {
  const [source, setSource] = useState(false)

  return (
    <div className="html-detail">
      <div className="html-detail__head">
        <span className="html-detail__caption">{caption}</span>
        <button className="button" onClick={() => setSource((current) => !current)} type="button">
          {source ? 'Rendered' : 'Source'}
        </button>
      </div>

      {source ? (
        <CodeBlock code={html} language="markup" />
      ) : (
        <div className="detail-card">
          <RawHtml html={html} />
        </div>
      )}
    </div>
  )
}
