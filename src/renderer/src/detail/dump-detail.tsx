import { VarDump } from '../ui/var-dump'

export function DumpDetail({ html }: { html: string }) {
  return (
    <div className="detail-card">
      <VarDump html={html} />
    </div>
  )
}
