import { useState } from 'react'
import type { OutgoingCall } from '../../../shared/http-client'
import { SaveAsMockDialog } from '../mocks/save-as-mock-dialog'
import type { MocksData } from '../mocks/use-mocks'
import { CallDetail } from './call-detail'
import { CallList } from './call-list'
import type { HttpClientState } from './use-http-client'

/** The page: what left this application, and what came back. */
export function HttpView({ http, mocks }: { http: HttpClientState; mocks: MocksData }) {
  const [saving, setSaving] = useState<OutgoingCall | null>(null)

  return (
    <div className="hc">
      <CallList http={http} />
      <CallDetail http={http} onSaveAsMock={setSaving} />
      {saving === null ? null : (
        <SaveAsMockDialog call={saving} mocks={mocks} onClose={() => setSaving(null)} />
      )}
    </div>
  )
}
