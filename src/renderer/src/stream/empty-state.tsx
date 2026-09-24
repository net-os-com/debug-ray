const SNIPPET = `ray('Dashboard mounted');
ray($user)->label('auth');
ray()->measure();
ray()->confetti();`

export function EmptyState({ target }: { target: string }) {
  return (
    <div className="empty">
      <div className="empty__inner">
        <div className="empty__badge">
          <span className="empty__pulse" />
        </div>
        <div className="empty__title">Waiting for events</div>
        <div className="empty__body">
          Nothing has come in yet. Send something from your app and it shows up here.
        </div>
        <pre className="empty__snippet">{SNIPPET}</pre>
        <div className="empty__target">{target}</div>
      </div>
    </div>
  )
}
