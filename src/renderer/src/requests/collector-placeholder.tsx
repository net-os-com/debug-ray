/** The canvas leaves every collector but Queries for a later pass. */
export function CollectorPlaceholder({ title }: { title: string }) {
  return (
    <div className="collector-placeholder">
      <div className="collector-placeholder__title">{title}</div>
      <div className="collector-placeholder__body">
        This collector gets its own screen in the next pass.
      </div>
    </div>
  )
}
