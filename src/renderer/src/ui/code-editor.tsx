import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { CompletionPopup } from '../tinker/completion-popup'
import type { ClassEntry } from '../tinker/rank-classes'

/** One coloured span on a line. Every language tokenizer returns these. */
export type EditorToken = { text: string; color: string; italic: boolean }

/**
 * What a language offers while typing, or null when it offers nothing.
 *
 * Bundled into one prop rather than four: the editor either has a completion
 * source or it has not, and splitting that across separate props would let a
 * caller supply half of one.
 */
export type Completion = {
  /** The token under the caret, or null when there is nothing to complete. */
  tokenAt: (code: string, caret: number) => { text: string; start: number; end: number } | null
  search: (token: string) => ClassEntry[]
  /** Writes a picked entry back, and says where the caret lands. */
  apply: (code: string, caret: number, entry: ClassEntry) => { code: string; caret: number }
}

/** The canvas' editor size; the line height follows from it. */
const FONT_SIZE = 13
const LINE_HEIGHT = Math.round(FONT_SIZE * 1.65)
const PAD_TOP = 16
const PAD_LEFT = 8

type CodeEditorProps = {
  code: string
  /** Highlights one line; the shell knows nothing about the language. */
  tokenize: (line: string) => EditorToken[]
  completion?: Completion | null
  onChange: (code: string) => void
  onRun?: () => void
}

type Suggestion = {
  entries: ClassEntry[]
  active: number
  left: number
  top: number
}

/**
 * A textarea with the highlighted copy painted underneath it.
 *
 * The textarea keeps its own text transparent, so what you read is the coloured
 * layer and what you edit is the real control — which is what keeps the caret,
 * selection, undo and spellcheck behaving like a textarea instead of like a
 * contenteditable pretending to be one. The two layers therefore have to share
 * every metric that affects where a glyph lands: font, padding, line height and
 * `white-space: pre`.
 *
 * That shared grid pays off twice: with a monospace font the caret's pixel
 * position is arithmetic, so the completion popup can be placed without asking
 * the browser where anything is.
 */
export function CodeEditor({ code, tokenize, completion = null, onChange, onRun }: CodeEditorProps) {
  const area = useRef<HTMLTextAreaElement>(null)
  const ruler = useRef<HTMLSpanElement>(null)
  const [charWidth, setCharWidth] = useState(0)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const lines = code.split('\n')

  // One measurement of the actual rendered font beats hard-coding a width that
  // is right on one machine and half a pixel off on the next.
  useLayoutEffect(() => {
    const width = ruler.current?.getBoundingClientRect().width ?? 0

    if (width > 0) {
      setCharWidth(width / 50)
    }
  }, [])

  const close = useCallback(() => setSuggestion(null), [])

  const suggest = useCallback(() => {
    const element = area.current

    if (element === null || completion === null || charWidth === 0) {
      return
    }

    const caret = element.selectionStart

    if (caret !== element.selectionEnd) {
      close()

      return
    }

    const token = completion.tokenAt(element.value, caret)

    if (token === null) {
      close()

      return
    }

    const entries = completion.search(token.text)

    if (entries.length === 0) {
      close()

      return
    }

    const before = element.value.slice(0, token.start)
    const line = before.split('\n').length - 1
    const column = token.start - (before.lastIndexOf('\n') + 1)

    setSuggestion({
      entries,
      active: 0,
      left: PAD_LEFT + column * charWidth,
      top: PAD_TOP + (line + 1) * LINE_HEIGHT,
    })
  }, [completion, charWidth, close])

  const accept = useCallback(
    (entry: ClassEntry) => {
      const element = area.current

      if (element === null) {
        return
      }

      if (completion === null) {
        return
      }

      const next = completion.apply(element.value, element.selectionStart, entry)

      onChange(next.code)
      close()

      requestAnimationFrame(() => {
        element.selectionStart = next.caret
        element.selectionEnd = next.caret
      })
    },
    [onChange, close],
  )

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      // Not every language has something to run; the ERD has no run key.
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && onRun !== undefined) {
        event.preventDefault()
        close()
        onRun()

        return
      }

      if (suggestion !== null) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()

          const step = event.key === 'ArrowDown' ? 1 : -1
          const count = suggestion.entries.length

          setSuggestion({
            ...suggestion,
            active: (suggestion.active + step + count) % count,
          })

          return
        }

        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault()
          accept(suggestion.entries[suggestion.active] as ClassEntry)

          return
        }

        if (event.key === 'Escape') {
          event.preventDefault()
          close()

          return
        }
      }

      if (event.key !== 'Tab') {
        return
      }

      // Tab moves focus by default, which in a code editor loses your place.
      event.preventDefault()

      const element = event.currentTarget
      const { selectionStart, selectionEnd, value } = element
      const next = `${value.slice(0, selectionStart)}    ${value.slice(selectionEnd)}`

      onChange(next)

      requestAnimationFrame(() => {
        element.selectionStart = selectionStart + 4
        element.selectionEnd = selectionStart + 4
      })
    },
    [suggestion, accept, close, onChange, onRun],
  )

  // Suggestions follow the caret, however it moved.
  useEffect(() => {
    const element = area.current

    if (element === null) {
      return
    }

    const update = (): void => suggest()

    element.addEventListener('click', update)
    element.addEventListener('keyup', update)
    element.addEventListener('blur', close)

    return () => {
      element.removeEventListener('click', update)
      element.removeEventListener('keyup', update)
      element.removeEventListener('blur', close)
    }
  }, [suggest, close])

  return (
    <div
      className="code-editor"
      style={{ fontSize: `${FONT_SIZE}px`, lineHeight: `${LINE_HEIGHT}px` }}
    >
      <div className="code-editor__numbers">
        {lines.map((_, index) => (
          <div key={index} style={{ height: `${LINE_HEIGHT}px` }}>
            {index + 1}
          </div>
        ))}
      </div>

      <div className="code-editor__field">
        <span aria-hidden="true" className="code-editor__ruler" ref={ruler}>
          00000000000000000000000000000000000000000000000000
        </span>

        <div aria-hidden="true" className="code-editor__paint">
          {lines.map((line, index) => (
            <div key={index} style={{ height: `${LINE_HEIGHT}px` }}>
              {tokenize(line).map((token, position) => (
                <span
                  key={position}
                  style={{ color: token.color, fontStyle: token.italic ? 'italic' : 'normal' }}
                >
                  {token.text}
                </span>
              ))}
            </div>
          ))}
        </div>

        <textarea
          className="code-editor__input"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          ref={area}
          spellCheck={false}
          value={code}
          wrap="off"
        />

        {suggestion === null ? null : (
          <CompletionPopup
            active={suggestion.active}
            entries={suggestion.entries}
            left={suggestion.left}
            onPick={accept}
            top={suggestion.top}
          />
        )}
      </div>
    </div>
  )
}
