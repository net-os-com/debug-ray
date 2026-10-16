/**
 * Vite's `import.meta.glob`, declared here rather than by pulling in
 * `vite/client`.
 *
 * That package's types also redeclare every asset import, which this project
 * already describes itself in `css.d.ts`; taking the whole thing to get one
 * function would mean two sources of truth for the rest.
 */
interface ImportMeta {
  glob: (
    pattern: string,
    options: { eager: true; import: 'default'; query: '?raw' },
  ) => Record<string, string>
}
