import { FramesDetail, type Frame } from './frames-detail'

type ErrorDetailProps = {
  content: Record<string, unknown>
  hideVendorFrames: boolean
}

export function ErrorDetail({ content, hideVendorFrames }: ErrorDetailProps) {
  const frames = Array.isArray(content.frames) ? (content.frames as Frame[]) : []

  return (
    <div>
      <div className="error-box">
        <div className="error-box__type">{String(content.class ?? 'Exception')}</div>
        <div className="error-box__message">{String(content.message ?? '')}</div>
      </div>

      <div className="detail-heading">Stack trace</div>
      <FramesDetail frames={frames} hideVendorFrames={hideVendorFrames} />
    </div>
  )
}
