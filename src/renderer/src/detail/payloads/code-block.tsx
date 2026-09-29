import { useState } from 'react'
import { CopyButton } from '../../ui/copy-button'
import { tokenize } from '../../tinker/php-tokens'
import { tokenizeMarkup } from './markup-tokens'

/** The two the app can already scan; anything else is shown as it arrived. */
export type Language = 'markup' | 'php' | null

type CodeBlockProps = {
  code: string
  /** Shown in the header strip, next to the line count. */
  caption?: string
  language?: Language
}

/** Past this, numbering every line costs more than it gives. */
const MAX_LINES = 5_000

/**
 * Text that is code: monospaced, numbered, and wrapped only if you ask.
 *
 * Long lines wrap by default everywhere else in the panel, which is right for
 * prose and wrong for a file — a wrapped line breaks the one thing numbering is
 * for, which is being able to say "line 40" and have it be the fortieth row.
 */
export function CodeBlock({ code, caption, language = null }: CodeBlockProps) {
  const [wrap, setWrap] = useState(false)
  const lines = code.split('\n')
  const shown = lines.slice(0, MAX_LINES)

  return (
    <div className="code-block">
      <div className="code-block__head">
        {caption === undefined ? null : <span className="code-block__caption">{caption}</span>}
        <span className="code-block__count">
          {lines.length} {lines.length === 1 ? 'line' : 'lines'}
        </span>
        <button className="button" onClick={() => setWrap((current) => !current)} type="button">
          {wrap ? 'No wrap' : 'Wrap'}
        </button>
        <CopyButton label="Copy" text={code} />
      </div>

      <div className={wrap ? 'code-block__body code-block__body--wrap' : 'code-block__body'}>
        {shown.map((line, index) => (
          <div className="code-block__line" key={index}>
            <span className="code-block__number">{index + 1}</span>
            <span className="code-block__text">
              <Line language={language} text={line} />
            </span>
          </div>
        ))}
      </div>

      {lines.length > shown.length ? (
        <div className="code-block__more">
          {lines.length - shown.length} more lines. Copy to see the whole thing.
        </div>
      ) : null}
    </div>
  )
}

function Line({ text, language }: { text: string; language: Language }) {
  if (text === '') {
    return '\u00a0'
  }

  if (language === 'markup') {
    return tokenizeMarkup(text).map((token, index) => (
      <span className={`code-block__${token.type}`} key={index}>
        {token.text}
      </span>
    ))
  }

  if (language === 'php') {
    return tokenize(text).map((token, index) => (
      <span key={index} style={{ color: token.color, fontStyle: token.italic ? 'italic' : undefined }}>
        {token.text}
      </span>
    ))
  }

  return text
}
