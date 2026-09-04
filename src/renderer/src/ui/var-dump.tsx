import { useEffect, useRef, type MouseEvent } from 'react'
import { addDumpToggles, stripDumperAssets } from './sf-dump'

/**
 * Owns its subtree outside React on purpose. With dangerouslySetInnerHTML,
 * React rewrites the <pre> on any later render of the list and wipes the
 * collapse toggles we inject; writing innerHTML from the effect keeps a single
 * owner, and the effect only re-runs when the dump itself changes.
 */
export function VarDump({ html }: { html: string }) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = container.current

    if (!root) {
      return
    }

    root.innerHTML = stripDumperAssets(html)
    addDumpToggles(root)
  }, [html])

  function toggle(event: MouseEvent<HTMLDivElement>): void {
    const clicked = (event.target as HTMLElement).closest('.dump-toggle')
    const samp = clicked?.nextElementSibling

    if (!(samp instanceof HTMLElement)) {
      return
    }

    const collapsed = samp.classList.toggle('sf-dump-compact')

    samp.classList.toggle('sf-dump-expanded', !collapsed)
    clicked?.classList.toggle('is-collapsed', collapsed)
  }

  return <div className="var-dump" ref={container} onClick={toggle} />
}
