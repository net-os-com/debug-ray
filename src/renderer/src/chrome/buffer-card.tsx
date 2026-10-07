import { useSettingsValue } from '../settings-context'

export function BufferCard({ count }: { count: number }) {
  const { eventBuffer } = useSettingsValue()

  return (
    <div className="buffer-card">
      <div className="buffer-card__title">Buffer</div>
      <div className="buffer-card__body">
        {count} of {eventBuffer} events kept. Older events drop off automatically.
      </div>
    </div>
  )
}
