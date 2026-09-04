/** ray()->green() and friends, mapped onto the design system's ramps. */
const COLORS: Record<string, string> = {
  green: 'rgb(var(--color-green-600))',
  red: 'rgb(var(--color-red-600))',
  orange: 'rgb(var(--color-yellow-600))',
  blue: 'rgb(var(--color-brand-primary-400))',
  purple: 'rgb(var(--color-brand-primary-500))',
  gray: 'rgb(var(--color-gray-500))',
  grey: 'rgb(var(--color-gray-500))',
}

export function rayColor(name: string | undefined): string | null {
  return name ? (COLORS[name.toLowerCase()] ?? null) : null
}
