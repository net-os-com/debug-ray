import { CodeEditor } from '../ui/code-editor'
import { tokenizeDbml } from './dbml-tokens'
import type { Problem } from './problems'

type EditorPaneProps = {
  code: string
  problems: Problem[]
  onChange: (code: string) => void
}

export function EditorPane({ code, problems, onChange }: EditorPaneProps) {
  return (
    <div className="erd-editor">
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
                {problem.line}
              </span>
              <span>{problem.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
