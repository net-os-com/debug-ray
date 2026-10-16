import { StrokeIcon } from '../chrome/module-icons'

/** The chevron every icon in the app is drawn on, pointing down or right. */
const CHEVRON_PATH = 'm6 9 6 6 6-6'

/**
 * The open/shut marker on a row that holds other rows.
 *
 * An icon rather than the ▾ and ▸ characters this sidebar used to use: at 11px
 * those render as a speck in most fonts, which is how a caret ends up looking
 * like a stray full stop.
 */
export function Caret({ open }: { open: boolean }) {
  return (
    <span className={open ? 'api-side__caret' : 'api-side__caret api-side__caret--shut'}>
      <StrokeIcon path={CHEVRON_PATH} size={12} />
    </span>
  )
}
