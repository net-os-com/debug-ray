import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { applyCompletion, classToken } from './completion'
import { CompletionPopup } from './completion-popup'
import { tokenize } from './php-tokens'
import { searchClasses, type ClassEntry, type ClassIndex } from './rank-classes'

/** The canvas' editor size; the line height follows from it. */
const FONT_SIZE = 13
const LINE_HEIGHT = Math.round(FONT_SIZE * 1.65)
const PAD_TOP = 16
const PAD_LEFT = 8

type CodeEditorProps = {
  code: string
  classes: ClassIndex
  onChange: (code: string) => void
  onRun: () => void
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
export function CodeEditor({ code, classes, onChange, onRun }: CodeEditorProps) {
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

    if (element === null || classes.length === 0 || charWidth === 0) {
      return
    }

    const caret = element.selectionStart

    if (caret !== element.selectionEnd) {
      close()

      return
    }

    const token = classToken(element.value, caret)

    if (token === null) {
      close()

      return
    }

    const entries = searchClasses(classes, token.text)

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
  }, [classes, charWidth, close])

  const accept = useCallback(
    (entry: ClassEntry) => {
      const element = area.current

      if (element === null) {
        return
      }

      const token = classToken(element.value, element.selectionStart)

      if (token === null) {
        close()

        return
      }

      const next = applyCompletion(element.value, token, entry.fqcn)

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
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
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
