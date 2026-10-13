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

export function EditorPane({ code, problems, savedLabel, onChange }: EditorPaneProps) {
  const errors = problems.filter((one) => one.severity === 'error').length
  const warnings = problems.length - errors

  return (
    <section className="erd-editor">
      <div className="erd-editor__head">
        <span className="erd-editor__file">schema.dbml</span>
        <span className="erd-editor__saved">{savedLabel}</span>
        <span className={`erd-editor__badge erd-editor__badge--${badgeKind(errors, warnings)}`}>
          {badge(errors, warnings)}
        </span>
      </div>

      <div className="erd-editor__code">
        <CodeEditor code={code} onChange={onChange} tokenize={tokenizeDbml} />
      </div>

      <div className="erd-editor__problems">
        {problems.length === 0 ? (
          <div className="erd-editor__clean">No problems</div>
        ) : (
          problems.map((problem, index) => (
            <div className="erd-editor__problem" key={`${problem.line}-${index}`}>
              <span
                className={
                  problem.severity === 'error'
                    ? 'erd-editor__line erd-editor__line--error'
                    : 'erd-editor__line'
                }
              >
                {problem.line === 0 ? '—' : problem.line}
              </span>
              <span>{problem.message}</span>
            </div>
          ))
        )}
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
