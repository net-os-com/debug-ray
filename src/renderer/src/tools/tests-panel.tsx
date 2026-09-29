import { ConsolePane } from './console-pane'
import { suitesOf, type TestsState } from './use-tests'

export function TestsPanel({ tests }: { tests: TestsState }) {
  const suites = suitesOf(tests.files)
  const cases = tests.files.reduce((total, file) => total + file.cases.length, 0)

  return (
    <section className="artisan">
      <div className="artisan__head">
        <div className="artisan__title">
          <span className="artisan__name">Tests</span>
          <span className="artisan__description">
            {tests.loading
              ? 'Reading the suite…'
              : `${tests.files.length} files · ${cases} tests`}
          </span>
        </div>

        <input
          className="tools__select"
          data-find="tests"
          onChange={(event) => tests.setQuery(event.target.value)}
          placeholder="Search tests"
          value={tests.query}
        />

        {suites.map((suite) => (
          <button
            className="button"
            disabled={tests.stream.running}
            key={suite.name}
            onClick={() => tests.runSuite(suite.name)}
            type="button"
          >
            {suite.name}
          </button>
        ))}

        <button
          className="button button--primary"
          disabled={tests.stream.running}
          onClick={tests.runAll}
          type="button"
        >
          Run all
        </button>
      </div>

      <Result tests={tests} />

      <div className="tests">
        {tests.shown.length === 0 ? (
          <div className="scout__empty">
            {tests.loading
              ? 'Looking for test files…'
              : tests.files.length === 0
                ? 'No tests directory in this container.'
                : `Nothing matches “${tests.query}”`}
          </div>
        ) : (
          tests.shown.map((file) => (
            <div className="tests__file" key={file.path}>
              <div className="tests__row">
                <button
                  className="tests__disclose"
                  onClick={() => tests.toggle(file.path)}
                  type="button"
                >
                  {tests.open === file.path ? '▾' : '▸'}
                </button>

                <span className="tests__suite">{file.suite}</span>
                <span className="tests__name" title={file.path}>
                  {file.name}
                </span>
                <span className="tests__count">{file.cases.length}</span>

                <button
                  className="button"
                  disabled={tests.stream.running}
                  onClick={() => tests.runFile(file)}
                  type="button"
                >
                  Run
                </button>
              </div>

              {tests.open === file.path
                ? file.cases.map((name) => (
                    <div className="tests__case" key={name}>
                      <span className="tests__case-name">{name}</span>
                      <button
                        className="button"
                        disabled={tests.stream.running}
                        onClick={() => tests.runCase(file, name)}
                        type="button"
                      >
                        Run
                      </button>
                    </div>
                  ))
                : null}
            </div>
          ))
        )}
      </div>

      <ConsolePane
        empty="Pick a test and run it. The database is not rebuilt: each test rolls itself back."
        exitCode={tests.stream.exitCode}
        lines={tests.stream.lines}
        onClear={tests.stream.clear}
        onStop={tests.stream.stop}
        problem={tests.stream.problem}
        running={tests.stream.running}
      />
    </section>
  )
}

/**
 * After four hundred lines of a passing run you should not have to scroll to
 * find out whether it passed.
 */
function Result({ tests }: { tests: TestsState }) {
  const { summary, stream, target } = tests

  if (!summary.finished && !stream.running) {
    return null
  }

  if (stream.running) {
    return (
      <div className="tests__result">
        <span className="console__pulse" />
        <span className="tests__result-text">running {target}</span>
      </div>
    )
  }

  const green = summary.failed === 0

  return (
    <div className={green ? 'tests__result tests__result--ok' : 'tests__result tests__result--bad'}>
      <span className="tests__result-count">
        {summary.failed > 0 ? `${summary.failed} failed` : `${summary.passed} passed`}
      </span>
      <span className="tests__result-text">
        {[
          summary.failed > 0 && summary.passed > 0 ? `${summary.passed} passed` : '',
          summary.skipped > 0 ? `${summary.skipped} skipped` : '',
          summary.pending > 0 ? `${summary.pending} pending` : '',
          summary.duration === '' ? '' : `in ${summary.duration}`,
          target,
        ]
          .filter(Boolean)
          .join(' · ')}
      </span>

      {summary.failures.map((failure) => (
        <span className="tests__failure" key={failure.test} title={`${failure.test} — ${failure.reason}`}>
          {failure.test.split('>').pop()?.trim()} <em>{failure.reason}</em>
        </span>
      ))}
    </div>
  )
}
