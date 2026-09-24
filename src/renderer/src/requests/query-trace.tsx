import type { QueryFrame } from './types'

export function QueryTrace({ frames }: { frames: QueryFrame[] }) {
  if (frames.length === 0) {
    return <div className="query-detail__none">No backtrace was captured.</div>
  }

  return (
    <div className="trace">
      {frames.map((frame, index) => (
        <div
          className={frame.application ? 'trace__frame' : 'trace__frame trace__frame--vendor'}
          key={index}
        >
          <span className="trace__n">{index + 1}</span>
          <span className="trace__callable">{frame.callable}</span>
          <span className="trace__file">{frame.file}</span>
        </div>
      ))}
    </div>
  )
}
