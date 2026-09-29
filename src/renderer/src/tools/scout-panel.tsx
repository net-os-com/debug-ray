import { useEffect } from 'react'
import { ConsolePane } from './console-pane'
import { drift, type ScoutState } from './use-scout'

type ScoutPanelProps = {
  scout: ScoutState
  tenants: string[]
}

export function ScoutPanel({ scout, tenants }: ScoutPanelProps) {
  // Opening the panel is the request. Making you press Check as well turns a
  // glance into two steps, and the first one is always the same.
  useEffect(() => {
    if (!scout.checked && !scout.loading && scout.tenant !== '') {
      void scout.check()
    }
  }, [scout])

  // Rows that could not be read are one fact about the connection, not ten
  // separate failures to read one by one.
  const failed = scout.rows.filter((row) => row.error !== null).length

  // Two models writing to one index make a per-model difference meaningless:
  // neither count is wrong, they simply are not counting the same thing.
  const shared = new Set(
    scout.rows
      .map((row) => row.index)
      .filter((index, position, all) => index !== '' && all.indexOf(index) !== position),
  )

  return (
    <section className="artisan">
      <div className="artisan__head">
        <div className="artisan__title">
          <span className="artisan__name">Search indexes</span>
          <span className="artisan__description">
            What the database holds, next to what the engine has
          </span>
        </div>

        <select
          className="tools__select"
          onChange={(event) => scout.setTenant(event.target.value)}
          value={scout.tenant}
        >
          <option value="">Central</option>
          {tenants.map((tenant) => (
            <option key={tenant} value={tenant}>
              {tenant}
            </option>
          ))}
        </select>

        <button
          className="button button--primary"
          disabled={scout.loading}
          onClick={() => void scout.check()}
          type="button"
        >
          {scout.loading ? 'Checking' : 'Check'}
        </button>
      </div>

      <div className="scout">
        {!scout.checked ? (
          <div className="scout__empty">
            Pick a tenant and check. Both sides are per tenant: the rows live in that
            tenant's database, and the index name is derived from it.
          </div>
        ) : scout.rows.length === 0 ? (
          <div className="scout__empty">No searchable models found.</div>
        ) : (
          <>
            {failed === 0 ? null : (
              <div className="scout__note">
                {failed} of {scout.rows.length} models have no table on{' '}
                {scout.tenant === '' ? 'the central connection' : `tenant ${scout.tenant}`}. Under
                multi-database tenancy most of them live in a tenant's database.
              </div>
            )}

            <table className="scout__table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Index</th>
                <th className="scout__number">Database</th>
                <th className="scout__number">Indexed</th>
                <th className="scout__number">Drift</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {scout.rows.map((row) => {
                const gap = drift(row)

                return (
                  <tr key={row.model}>
                    <td className="scout__model">{row.model.split('\\').pop()}</td>
                    <td className="scout__index">
                      {row.index}
                      {shared.has(row.index) ? <span className="scout__flag">shared</span> : null}
                    </td>
                    <td className="scout__number">{row.db ?? '—'}</td>
                    <td className="scout__number">
                      {row.indexed ?? '—'}
                      {row.approximate ? <span className="scout__flag">approx</span> : null}
                      {row.indexing ? <span className="scout__flag">indexing</span> : null}
                    </td>
                    <td
                      className="scout__number"
                      style={{ color: gap === null || gap === 0 ? 'var(--t3)' : 'var(--err-fg)' }}
                    >
                      {gap === null || shared.has(row.index)
                        ? '—'
                        : gap === 0
                          ? 'in sync'
                          : gap > 0
                            ? `+${gap}`
                            : gap}
                    </td>
                    <td className="scout__action">
                      {row.error !== null ? (
                        <span className="scout__error" title={row.error}>
                          {row.error}
                        </span>
                      ) : (
                        <>
                          {scout.armed === row.model ? (
                            <button className="button" onClick={scout.disarm} type="button">
                              Cancel
                            </button>
                          ) : null}
                          <button
                            className={scout.armed === row.model ? 'button button--danger' : 'button'}
                            disabled={scout.stream.running}
                            onClick={() => scout.reimport(row.model)}
                            type="button"
                          >
                            {scout.armed === row.model ? 'Yes, reimport' : 'Reimport'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            </table>
          </>
        )}
      </div>

      <ConsolePane
        empty="A reimport reports here."
        exitCode={scout.stream.exitCode}
        lines={scout.stream.lines}
        onClear={scout.stream.clear}
        onStop={scout.stream.stop}
        problem={scout.stream.problem}
        running={scout.stream.running}
      />
    </section>
  )
}
