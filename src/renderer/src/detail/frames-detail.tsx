type SnippetLine = { line_number: number; text: string }

export type Frame = {
  file_name?: string | null
  line_number?: number | string | null
  class?: string | null
  method?: string | null
  vendor_frame?: boolean
  snippet?: SnippetLine[]
}

type FramesDetailProps = {
  frames: Frame[]
  hideVendorFrames: boolean
}

export function FramesDetail({ frames, hideVendorFrames }: FramesDetailProps) {
  const application = frames.filter((frame) => !frame.vendor_frame)

  // Never show an empty trace just because everything was vendor code.
  const shown = hideVendorFrames && application.length > 0 ? application : frames

  if (shown.length === 0) {
    return null
  }

  return (
    <div className="frames">
      {shown.map((frame, index) => (
        <div
          className={frame.vendor_frame ? 'frame frame--vendor' : 'frame'}
          key={`${frame.file_name}:${frame.line_number}:${index}`}
        >
          <div className="frame__callable">{callable(frame)}</div>
          <div className="frame__file">
            {frame.file_name}:{frame.line_number}
          </div>
          {!frame.vendor_frame && frame.snippet?.length ? (
            <pre className="frame__snippet">
              {frame.snippet
                .map((line) => `${String(line.line_number).padStart(4)}  ${line.text}`)
                .join('\n')}
            </pre>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function callable(frame: Frame): string {
  if (frame.class && frame.method) {
    return `${frame.class}::${frame.method}`
  }

  return frame.method ?? frame.class ?? '(closure)'
}
