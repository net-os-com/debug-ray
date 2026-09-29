import { ConsolePane } from './console-pane'
import type { ArtisanState } from './use-artisan'

export function ArtisanPanel({ artisan }: { artisan: ArtisanState }) {
  const { selected } = artisan

  return (
    <>
      <aside className="command-list">
        <div className="command-list__head">
          <input
            onChange={(event) => artisan.setQuery(event.target.value)}
            data-find="artisan"
            placeholder={`Search ${artisan.total} commands`}
            value={artisan.query}
          />
        </div>

        <div className="command-list__body">
          {artisan.commands.map((command) => (
            <button
              className={
                command.name === selected?.name ? 'command command--active' : 'command'
              }
              key={command.name}
              onClick={() => artisan.select(command.name)}
              type="button"
            >
              <span className="command__name">{command.name}</span>
              <span className="command__description">{command.description}</span>
            </button>
          ))}

          {artisan.commands.length === 0 ? (
            <div className="command-list__none">
              {artisan.total === 0 ? 'No container to read commands from.' : 'Nothing matches.'}
            </div>
          ) : null}
        </div>
      </aside>

      <section className="artisan">
        {selected === null ? (
          <div className="artisan__empty">Pick a command to run.</div>
        ) : (
          <>
            <div className="artisan__head">
              <div className="artisan__title">
                <span className="artisan__name">{selected.name}</span>
                <span className="artisan__description">{selected.description}</span>
              </div>

              {artisan.armed ? (
                <button className="button" onClick={artisan.disarm} type="button">
                  Cancel
                </button>
              ) : null}

              <button
                className={artisan.armed ? 'button button--danger' : 'button button--primary'}
                disabled={artisan.stream.running || artisan.missing.length > 0}
                onClick={artisan.run}
                type="button"
              >
                {artisan.armed ? 'Yes, run it' : artisan.stream.running ? 'Running' : 'Run'}
              </button>
            </div>

            {artisan.armed ? (
              <div className="artisan__warning">
                <strong>{selected.name}</strong> throws data away and cannot be undone.
              </div>
            ) : null}

            <code className="artisan__preview">{artisan.preview}</code>

            {selected.arguments.length === 0 && selected.options.length === 0 ? null : (
              <div className="artisan__form">
                {selected.arguments.map((argument) => (
                  <label className="field" key={argument.name}>
                    <span className="field__label">
                      {argument.name}
                      {argument.required ? <span className="field__required">required</span> : null}
                      {argument.array ? <span className="field__hint">comma separated</span> : null}
                    </span>
                    <input
                      onChange={(event) => artisan.setArg(argument.name, event.target.value)}
                      placeholder={argument.description}
                      value={artisan.values.args[argument.name] ?? ''}
                    />
                  </label>
                ))}

                {selected.options.map((option) =>
                  option.acceptsValue ? (
                    <label className="field" key={option.name}>
                      <span className="field__label">
                        {option.name}
                        {option.multiple ? <span className="field__hint">comma separated</span> : null}
                      </span>
                      <input
                        onChange={(event) => artisan.setOption(option.name, event.target.value)}
                        placeholder={option.description}
                        value={String(artisan.values.options[option.name] ?? '')}
                      />
                    </label>
                  ) : (
                    <label className="field field--flag" key={option.name}>
                      <input
                        checked={artisan.values.options[option.name] === true}
                        onChange={(event) => artisan.setOption(option.name, event.target.checked)}
                        type="checkbox"
                      />
                      <span className="field__label">{option.name}</span>
                      <span className="field__hint">{option.description}</span>
                    </label>
                  ),
                )}
              </div>
            )}

            <ConsolePane
              empty="Nothing has run yet."
              exitCode={artisan.stream.exitCode}
              lines={artisan.stream.lines}
              onClear={artisan.stream.clear}
              onStop={artisan.stream.stop}
              problem={artisan.stream.problem}
              running={artisan.stream.running}
            />
          </>
        )}
      </section>
    </>
  )
}
