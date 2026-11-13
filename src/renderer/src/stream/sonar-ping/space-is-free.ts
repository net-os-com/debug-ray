/**
 * Whether Space, pressed now, means nothing to anything else on the page.
 *
 * Nothing focused is the plain case. A button is the other one, when it only
 * holds focus because it was clicked: a click leaves focus on the nav rail or
 * a toolbar button for as long as you wait, and the hint's "press space" would
 * then press that button again instead. A button reached with the keyboard
 * keeps its Space, and so does every field.
 *
 * `clicked` is the button the last click landed on, forgotten as soon as the
 * keyboard moves focus — see `useClickedButton`. It has to be remembered:
 * Chromium marks a button `:focus-visible` the moment any key is pressed, so
 * by the time Space arrives the focus ring no longer says how it got there.
 */
export function spaceIsFree(
  focused: Element | null,
  body: Element | null,
  clicked: Element | null,
): boolean {
  if (focused === null || focused === body) {
    return true
  }

  return focused.tagName === 'BUTTON' && focused === clicked
}
