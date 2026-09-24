export function BindingsList({ bindings }: { bindings: string[] }) {
  if (bindings.length === 0) {
    return <div className="query-detail__none">This statement has no bindings.</div>
  }

  return (
    <div className="bindings">
      {bindings.map((value, index) => (
        <span className="binding" key={index}>
          <span className="binding__index">{index + 1}</span>
          <span className="binding__value">{value}</span>
        </span>
      ))}
    </div>
  )
}
