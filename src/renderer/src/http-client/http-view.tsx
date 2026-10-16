import { CallDetail } from './call-detail'
import { CallList } from './call-list'
import type { HttpClientState } from './use-http-client'

/** The page: what left this application, and what came back. */
export function HttpView({ http }: { http: HttpClientState }) {
  return (
    <div className="hc">
      <CallList http={http} />
      <CallDetail http={http} />
    </div>
  )
}
