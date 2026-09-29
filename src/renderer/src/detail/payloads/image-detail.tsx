import { useState } from 'react'
import { CopyButton } from '../../ui/copy-button'

type Loaded = { width: number; height: number }

/**
 * What `ray()->image()` sent, as a picture.
 *
 * The payload is a one-tag HTML document, and rendering it as markup does show
 * the image — at whatever size it happens to be, with no way to tell a failed
 * load from a transparent one, and nothing to click. Pulling the source out and
 * owning the element gets all three.
 */
/** Base64 carries four characters for every three bytes, padding aside. */
function bytes(dataUri: string): string {
  const encoded = dataUri.slice(dataUri.indexOf(',') + 1)
  const size = Math.floor((encoded.length * 3) / 4)

  return size < 1_024 ? `${size} B` : `${Math.round(size / 1_024)} KB`
}

export function ImageDetail({ src }: { src: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failed, setFailed] = useState(false)
  const [full, setFull] = useState(false)

  const label = src.startsWith('data:') ? `inline · ${bytes(src)}` : src.replace(/^file:\/\//, '')

  return (
    <div className="image-detail">
      <div className="image-detail__head">
        <span className="image-detail__source" title={label}>
          {label}
        </span>
        {loaded === null ? null : (
          <span className="image-detail__size">
            {loaded.width} × {loaded.height}
          </span>
        )}
        <button className="button" onClick={() => setFull((current) => !current)} type="button">
          {full ? 'Fit' : 'Full size'}
        </button>
        <CopyButton label="Copy source" text={src} />
      </div>

      {failed ? (
        <div className="image-detail__failed">
          This image could not be loaded. A <code>file://</code> path is read from the machine the
          app runs on, so one written inside a container will not resolve here.
        </div>
      ) : (
        <div className={full ? 'image-detail__frame image-detail__frame--full' : 'image-detail__frame'}>
          <img
            alt=""
            onError={() => setFailed(true)}
            onLoad={(event) =>
              setLoaded({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
            src={src}
          />
        </div>
      )}
    </div>
  )
}
