/** The icon paths used by the canvas, as components. */
type IconProps = { size?: number }

function Svg({ size = 16, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

export function MoonIcon({ size = 15 }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </Svg>
  )
}

export function GearIcon({ size = 17 }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="2.75" />
      <path d="M10.6 3.4a1.4 1.4 0 0 1 2.8 0l.14 1.1c.61.18 1.19.42 1.72.72l.9-.66a1.4 1.4 0 0 1 1.98 1.98l-.66.9c.3.53.54 1.11.72 1.72l1.1.14a1.4 1.4 0 0 1 0 2.8l-1.1.14c-.18.61-.42 1.19-.72 1.72l.66.9a1.4 1.4 0 0 1-1.98 1.98l-.9-.66c-.53.3-1.11.54-1.72.72l-.14 1.1a1.4 1.4 0 0 1-2.8 0l-.14-1.1a7.4 7.4 0 0 1-1.72-.72l-.9.66a1.4 1.4 0 0 1-1.98-1.98l.66-.9a7.4 7.4 0 0 1-.72-1.72l-1.1-.14a1.4 1.4 0 0 1 0-2.8l1.1-.14c.18-.61.42-1.19.72-1.72l-.66-.9a1.4 1.4 0 0 1 1.98-1.98l.9.66c.53-.3 1.11-.54 1.72-.72Z" />
    </Svg>
  )
}

export function SearchIcon({ size = 16 }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="10.5" cy="10.5" r="6.25" />
      <path d="m15.5 15.5 4 4" />
    </Svg>
  )
}

export function CloseIcon({ size = 12 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}
