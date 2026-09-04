export type Frame = {
  file_name?: string | null
  line_number?: number | string | null
  class?: string | null
  method?: string | null
  vendor_frame?: boolean
}

export function FrameList({ frames }: { frames: Frame[] }) {
  if (frames.length === 0) {
    return null
  }

  return (
    <ol className="frames">
      {frames.map((frame, index) => (
        <li
          className={frame.vendor_frame ? 'frames__item frames__item--vendor' : 'frames__item'}
          key={index}
        >
          <span className="frames__location">
            {frame.file_name}:{frame.line_number}
          </span>
          {frame.class || frame.method ? (
            <span className="frames__callable">
              {frame.class}
              {frame.class && frame.method ? '::' : ''}
              {frame.method}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
