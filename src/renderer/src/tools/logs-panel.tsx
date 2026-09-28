import { ConsolePane } from './console-pane'
import { LOG_LEVELS, type LogsState } from './use-logs'

export function LogsPanel({ logs }: { logs: LogsState }) {
  return (
    <section className="artisan">
      <div className="artisan__head">
        <div className="artisan__title">
          <span className="artisan__name">pail</span>
          <span className="artisan__description">
            Live application logs, straight from the container
          </span>
        </div>

        <select
          className="tools__select"
          onChange={(event) => logs.setLevel(event.target.value)}
          value={logs.level}
        >
          <option value="">Every level</option>
          {LOG_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>

        <input
          className="tools__input"
          onChange={(event) => logs.setFilter(event.target.value)}
          placeholder="Only lines matching…"
          value={logs.filter}
        />

        <button
          className="button button--primary"
          disabled={logs.stream.running}
          onClick={logs.start}
          type="button"
        >
          {logs.stream.running ? 'Tailing' : 'Start'}
        </button>
      </div>

      <ConsolePane
        empty="Press Start to tail the logs. A level or filter applies from the next start."
        exitCode={logs.stream.exitCode}
        lines={logs.stream.lines}
        onClear={logs.stream.clear}
        onStop={logs.stream.stop}
        problem={logs.stream.problem}
        running={logs.stream.running}
      />
    </section>
  )
}
