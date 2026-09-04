import { MAX_EVENTS } from '../use-ray-events'

export function BufferCard({ count }: { count: number }) {
  return (
    <div className="buffer-card">
      <div className="buffer-card__title">Buffer</div>
      <div className="buffer-card__body">
        {count} of {MAX_EVENTS} events kept. Older events drop off automatically.
      </div>
    </div>
  )
}
