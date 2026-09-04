const ASSET_TAGS = /<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi

/** Symfony's HtmlDumper output, as produced by Spatie\Ray\ArgumentConverter. */
export function isVarDump(value: unknown): value is string {
  return typeof value === 'string' && value.includes('class=sf-dump')
}

/**
 * Every dump ships its own <style> and <script> because ray builds a fresh
 * HtmlDumper per argument. The script never runs from innerHTML anyway, and the
 * style would fight our theme, so both go.
 */
export function stripDumperAssets(html: string): string {
  return html.replace(ASSET_TAGS, '').trim()
}

/**
 * Collapsing is normally added by Symfony's own JS. Nesting lives in
 * `samp[data-depth]` (sf-dump-expanded / sf-dump-compact), so we hang our own
 * toggle in front of each one and let the container handle the clicks.
 */
export function addDumpToggles(root: HTMLElement): void {
  const nested = root.querySelectorAll<HTMLElement>('samp[data-depth]')

  for (const samp of Array.from(nested)) {
    if (samp.previousElementSibling?.classList.contains('dump-toggle')) {
      continue
    }

    const toggle = document.createElement('a')

    toggle.className = 'dump-toggle'
    toggle.setAttribute('role', 'button')

    if (samp.classList.contains('sf-dump-compact')) {
      toggle.classList.add('is-collapsed')
    }

    samp.parentNode?.insertBefore(toggle, samp)
  }
}
