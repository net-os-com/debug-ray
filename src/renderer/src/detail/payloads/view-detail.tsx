import { JsonTree } from './json-tree'

/** `ray()->showViews()` — which Blade rendered, and what it was handed. */
export function ViewDetail({ content }: { content: Record<string, unknown> }) {
  const relative = text(content.view_path_relative_to_project_root)
  const absolute = text(content.view_path)

  return (
    <div className="detail-stack">
      <div className="view-detail__path" title={absolute}>
        {relative || absolute || 'unknown view'}
      </div>

      <div className="detail-heading">Data</div>
      <JsonTree value={content.data ?? {}} />
    </div>
  )
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
