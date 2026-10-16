/**
 * The design's icons, inline.
 *
 * They are the only ones the ERD uses and they are a few paths each, so they
 * live here rather than pulling in an icon package the rest of the app does
 * not have.
 */

export function KeyIcon() {
  return (
    <svg fill="none" height="13" stroke="var(--sql-num)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="13">
      <path d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.03 5.91c-.56-.1-1.16.03-1.56.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.82c0-.6.24-1.17.66-1.59l6.4-6.4c.4-.4.53-1 .43-1.56A6 6 0 1 1 21.75 8.25Z" />
    </svg>
  )
}

export function LinkIcon() {
  return (
    <svg fill="none" height="13" stroke="var(--sql-kw)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="13">
      <path d="M13.19 8.69a4.5 4.5 0 0 1 1.24 7.24l-4.5 4.5a4.5 4.5 0 0 1-6.36-6.36l1.76-1.76m13.35-.62 1.76-1.76a4.5 4.5 0 0 0-6.36-6.36l-4.5 4.5a4.5 4.5 0 0 0 1.24 7.24" />
    </svg>
  )
}

export function NoteIcon() {
  return (
    <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" width="14">
      <path d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.12 2.99 2.7 3.22 1.09.16 2.19.28 3.3.37V21l4.18-4.18a1.15 1.15 0 0 1 .8-.33c2.07-.05 4.1-.23 6.1-.53 1.58-.23 2.7-1.62 2.7-3.22V6.74c0-1.6-1.12-2.99-2.7-3.22A48.4 48.4 0 0 0 12 3c-2.4 0-4.74.18-7.06.52-1.58.23-2.69 1.62-2.69 3.22v6.02Z" />
    </svg>
  )
}

export function SearchIcon() {
  return (
    <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" viewBox="0 0 24 24" width="16">
      <circle cx="10.5" cy="10.5" r="6.25" />
      <path d="m15.5 15.5 4 4" />
    </svg>
  )
}

export function ChevronIcon() {
  return (
    <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="14">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function PlusIcon() {
  return (
    <svg fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" viewBox="0 0 24 24" width="15">
      <path d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

export function MinusIcon() {
  return (
    <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 24 24" width="14">
      <path d="M5 12h14" />
    </svg>
  )
}

export function PanelIcon() {
  return (
    <svg fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" width="15">
      <rect height="16" rx="2.5" width="18" x="3" y="4" />
      <path d="M9 4v16" />
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width="13">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

export function GripIcon() {
  return (
    <svg fill="currentColor" height="14" style={{ opacity: 0.7 }} viewBox="0 0 24 24" width="14">
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  )
}

export function UndoIcon() {
  return (
    <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="14">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-4" />
    </svg>
  )
}

export function RedoIcon() {
  return (
    <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="14">
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9a5 5 0 0 0 0 10h4" />
    </svg>
  )
}
