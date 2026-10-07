export type UrlToken = {
  text: string
  /** A chip is drawn with a background; plain text is not. */
  kind: 'literal' | 'variable' | 'param'
}

const SPLIT_VARIABLE = /(\{\{\s*[\w.-]+\s*\}\})/
const IS_VARIABLE = /^\{\{\s*[\w.-]+\s*\}\}$/
const SPLIT_PARAM = /(\{[^{}]+\})/
const IS_PARAM = /^\{([^{}]+)\}$/

/**
 * A URL, drawn so you can see what is fixed and what is not.
 *
 * `{{ tenant }}` comes from the environment and `{desk}` comes from the route,
 * and they are different things: one is the same for every request you send
 * tonight, the other changes every time. Printing both as plain text makes a
 * URL you have to parse yourself before you can trust it.
 */
export function urlTokens(path: string, params: Record<string, string>): UrlToken[] {
  const tokens: UrlToken[] = []

  for (const chunk of path.split(SPLIT_VARIABLE).filter((part) => part !== '')) {
    if (IS_VARIABLE.test(chunk)) {
      tokens.push({ text: chunk, kind: 'variable' })

      continue
    }

    for (const piece of chunk.split(SPLIT_PARAM).filter((part) => part !== '')) {
      const param = IS_PARAM.exec(piece)

      if (param === null) {
        tokens.push({ text: piece, kind: 'literal' })

        continue
      }

      // A filled parameter shows its value; an empty one keeps its name, so the
      // gap is visible rather than a silent blank in the middle of a path.
      const value = params[param[1]] ?? ''

      tokens.push({ text: value === '' ? param[1] : value, kind: 'param' })
    }
  }

  return tokens
}

/** The same treatment for a header value, which only has variables in it. */
export function valueTokens(value: string): UrlToken[] {
  return value
    .split(SPLIT_VARIABLE)
    .filter((part) => part !== '')
    .map((part) => ({ text: part, kind: IS_VARIABLE.test(part) ? 'variable' : 'literal' }))
}

/** Every `{param}` a path asks for, in the order it asks. */
export function pathParamNames(path: string): string[] {
  return [...new Set([...path.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]))]
}
