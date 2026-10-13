import { useEffect, useRef, useState } from 'react'
import { CodeEditor } from '../ui/code-editor'
import { tokenizeDbml } from './dbml-tokens'
import type { Problem } from './problems'

type EditorPaneProps = {
  code: string
  problems: Problem[]
  /** What the header says about the last save. */
  savedLabel: string
  onChange: (code: string) => void
}

/**
 * The DBML source, with its problems on the badge rather than under it.
 *
 * They used to sit in a strip along the bottom, which cost the editor a
 * hundred and thirty pixels to say "No problems" nearly all of the time, and
 * on the occasion it had something to say the text was the furthest thing on
 * screen from the badge that counted it. Now the badge is the control: it says
 * how many, and opens the list.
 */
export function EditorPane({ code, problems, savedLabel, onChange }: EditorPaneProps) {
  const [open, setOpen] = useState(false)
  const errors = problems.filter((one) => one.severity === 'error').length
  const warnings = problems.length - errors
  const head = useRef<HTMLDivElement>(null)

  // Opened by the badge, closed by anything else — including Escape, because a
  // popover you can only dismiss by finding its trigger again is a trap.
  useEffect(() => {
    if (!open) {
      return
    }

    const away = (event: MouseEvent): void => {
      if (!head.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const key = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('mousedown', away)
    window.addEventListener('keydown', key)

    return () => {
      window.removeEventListener('mousedown', away)
      window.removeEventListener('keydown', key)
    }
  }, [open])

  // A document that went from broken to clean while the list was open would
  // otherwise leave an empty panel hanging over the code.
  useEffect(() => {
    if (problems.length === 0) {
      setOpen(false)
    }
  }, [problems.length])

  return (
    <section className="erd-editor">
      <div className="erd-editor__head" ref={head}>
        <span className="erd-editor__file">schema.dbml</span>
        <span className="erd-editor__saved">{savedLabel}</span>

        <button
          className={`erd-editor__badge erd-editor__badge--${badgeKind(errors, warnings)}`}
          disabled={problems.length === 0}
          onClick={() => setOpen((shown) => !shown)}
          title={problems.length === 0 ? 'Nothing to report' : 'Show what is wrong'}
          type="button"
        >
          {badge(errors, warnings)}
        </button>

        {open ? (
          <div className="erd-editor__popover">
            {problems.map((problem, index) => (
              <div className="erd-editor__problem" key={`${problem.line}-${index}`}>
                <span
                  className={
                    problem.severity === 'error'
                      ? 'erd-editor__line erd-editor__line--error'
                      : 'erd-editor__line'
                  }
                >
                  {problem.line === 0 ? problem.severity : `line ${problem.line}`}
                </span>
                <span>{problem.message}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="erd-editor__code">
        <CodeEditor code={code} onChange={onChange} tokenize={tokenizeDbml} />
      </div>
    </section>
  )
}

function badge(errors: number, warnings: number): string {
  if (errors > 0) {
    const head = `${errors} error${errors > 1 ? 's' : ''}`

    return warnings === 0 ? head : `${head} · ${warnings} warning${warnings > 1 ? 's' : ''}`
  }

  if (warnings > 0) {
    return `${warnings} warning${warnings > 1 ? 's' : ''}`
  }

  return 'Valid DBML'
}

function badgeKind(errors: number, warnings: number): string {
  return errors > 0 ? 'error' : warnings > 0 ? 'warning' : 'ok'
}
