import type { View } from './view-nav'

/**
 * The module icons, exactly as the navigation canvas draws them: one path each,
 * on a 24 stroke grid.
 */
const PATHS: Record<Exclude<View, 'settings'>, string> = {
  stream: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12',
  requests: 'M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
  tinker:
    'm6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z',
  api: 'M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5',
  erd: 'M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125',
  tools:
    'M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z',
}

/** The bolt an action in the palette carries, as the canvas draws it. */
export const BOLT_PATH = 'm3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z'

type ModuleIconProps = { module: Exclude<View, 'settings'>; size?: number }

export function ModuleIcon({ module, size = 20 }: ModuleIconProps) {
  return <StrokeIcon path={PATHS[module]} size={size} />
}

type StrokeIconProps = { path: string; size?: number }

export function StrokeIcon({ path, size = 20 }: StrokeIconProps) {
  return (
    <svg
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      // The stroke is a screen width, not a drawing one: 1.5 on the 24 grid is
      // 1.5px at 24 and 0.75px at 12, which goes faint exactly where the icon
      // is already small. Kept at 1.5px whatever the icon is scaled to.
      strokeWidth={(1.5 * 24) / size}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d={path} />
    </svg>
  )
}

/** The sliders the canvas puts on the rail's settings button. */
export const SETTINGS_PATH =
  'M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75'

/** The NetOS mark the rail carries under the window controls. */
export function NetosMark() {
  return (
    <svg aria-label="NetOS" fill="none" height="23" viewBox="0 0 20.6 20" width="24">
      <path
        d="M20.104 4.1664C20.104 1.97579 18.3308 0.199951 16.1436 0.199951C13.9563 0.199951 12.1832 1.97579 12.1832 4.1664V16.0335C12.1832 18.2241 13.9563 20 16.1436 20C18.3308 20 20.104 18.2241 20.104 16.0335V4.1664Z"
        fill="currentColor"
        fillOpacity="0.55"
      />
      <path
        d="M0.500024 16.0336C0.500024 18.2242 2.31748 20 4.55943 20C6.80138 20 8.61884 18.2242 8.61884 16.0336L8.61884 4.16645C8.61884 1.97584 6.80138 0.200001 4.55943 0.200001C2.31748 0.200001 0.500024 1.97584 0.500024 4.16645L0.500024 16.0336Z"
        fill="currentColor"
        fillOpacity="0.55"
      />
      <path
        d="M18.6721 12.8453C20.6127 14.4597 20.4501 17.2327 18.9674 18.8163C17.4175 20.3484 14.7076 20.5266 13.1206 18.5495C11.8554 16.9812 12.0906 15.2827 11.3647 13.7398C10.8944 12.7042 10.21 11.7238 9.42227 10.908C8.61771 10.1013 7.65576 9.4067 6.64166 8.93007C5.12979 8.19477 3.47117 8.44349 1.9319 7.15559C-0.0087744 5.54119 0.153898 2.76823 1.63659 1.18459C3.1856 -0.348407 5.89545 -0.526582 7.48247 1.45049C8.74766 3.01876 8.51249 4.71726 9.23837 6.26021C9.70872 7.29577 10.3922 8.27617 11.1808 9.09196C11.9854 9.89871 12.9473 10.5933 13.9614 11.0699C15.4733 11.8052 17.1319 11.5574 18.6712 12.8444Z"
        fill="currentColor"
      />
    </svg>
  )
}
