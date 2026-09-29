/**
 * Payloads that steer Ray's own window rather than carry anything to look at.
 *
 * `newScreen()`, `clearScreen()`, `hide()`, `remove()` and the colour and size
 * calls exist to drive a UI with screens in it. This app has one stream, so
 * rather than show a line of JSON and leave you guessing, the row says what the
 * call was and what happened to it here.
 */
export function ScreenControl({ call, detail }: { call: string; detail?: string }) {
  return (
    <div className="screen-control">
      <span className="screen-control__call">{call}</span>
      {detail === undefined ? null : <span className="screen-control__detail">{detail}</span>}
      <span className="screen-control__note">
        A screen instruction. This app keeps one stream, so it is recorded and nothing moves.
      </span>
    </div>
  )
}

/** `color()` and `screenColor()` name a colour; showing it beats naming it. */
export function ColorSwatch({ color, call }: { color: string; call: string }) {
  return (
    <div className="screen-control">
      <span className="screen-control__swatch" style={{ background: color }} />
      <span className="screen-control__call">{call}</span>
      <span className="screen-control__detail">{color}</span>
    </div>
  )
}
