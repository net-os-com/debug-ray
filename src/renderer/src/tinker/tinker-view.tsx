import { useEffect, useRef, useState } from 'react'
import { CodeEditor } from './code-editor'
import { SnippetList } from './snippet-list'
import { OutputPane } from './output-pane'
import { Picker, type PickerItem } from './picker'
import { Splitter } from './splitter'
import type { SnippetsState } from './use-snippets'
import type { TinkerState } from './use-tinker'
import { useClassIndex } from './use-class-index'
import { useSideWidth } from './use-side-width'
import { useSplit } from './use-split'

/** Central is a choice, not the absence of one, so it sits in the list. */
const CENTRAL = ''

type Menu = 'container' | 'tenant' | null

type TinkerViewProps = {
  tinker: TinkerState
  snippets: SnippetsState
}

export function TinkerView({ tinker, snippets }: TinkerViewProps) {
  const body = useRef<HTMLDivElement>(null)
  const { split, resize, reset } = useSplit()
  const side = useSideWidth()
  const classes = useClassIndex(tinker.container)
  const [menu, setMenu] = useState<Menu>(null)

  // Held in a ref so the shortcut is registered once instead of on every
  // keystroke, and still runs whatever is in the editor right now.
  const latest = useRef(() => {})
  latest.current = () => void tinker.run(snippets.code)

  // Cmd+R runs, anywhere in the view — the menu gave up the accelerator for it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'r') {
        event.preventDefault()
        latest.current()
      }
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const containerItems: PickerItem[] = tinker.containers.map((container) => ({
    key: container.id,
    name: container.name,
    meta: `${container.image} · ${container.status}`,
    up: container.running,
    enabled: container.running,
  }))

  const tenantItems: PickerItem[] = [
    { key: CENTRAL, name: 'Central', meta: 'No tenant initialised', enabled: true },
    ...tinker.tenants.map((tenant) => ({ key: tenant, name: tenant, enabled: true })),
  ]

  return (
    <div className="tinker" ref={body}>
      <SnippetList snippets={snippets} width={side.width} />

      <Splitter
        onDrag={(clientX) => {
          const rect = body.current?.getBoundingClientRect()

          if (rect !== undefined) {
            side.resize(clientX - rect.left)
          }
        }}
        onReset={side.reset}
      />

      <section className="tinker-editor" style={{ flex: `${split} 1 0` }}>
        <div className="tinker-editor__head">
          <input
            className="tinker-editor__name"
            onChange={(event) => snippets.rename(event.target.value)}
            value={snippets.active.name}
          />

          <div className="tinker-editor__controls">
            <Picker
              items={containerItems}
              label="Docker"
              onSelect={(key) => {
                tinker.selectContainer(key)
                setMenu(null)
              }}
              onToggle={() => setMenu((current) => (current === 'container' ? null : 'container'))}
              open={menu === 'container'}
              value={tinker.container?.id ?? ''}
            />

            <Picker
              items={tenantItems}
              label="Tenant"
              onSelect={(key) => {
                tinker.setTenant(key)
                setMenu(null)
              }}
              onToggle={() => setMenu((current) => (current === 'tenant' ? null : 'tenant'))}
              open={menu === 'tenant'}
              value={tinker.tenant}
            />

            <button
              className="button"
              onClick={snippets.save}
              style={{ color: snippets.dirty ? 'var(--t1)' : 'var(--t3)' }}
              type="button"
            >
              {snippets.dirty ? 'Save' : 'Saved'}
            </button>

            <button
              className="button button--primary tinker-editor__run"
              disabled={tinker.running || tinker.container === null}
              onClick={() => void tinker.run(snippets.code)}
              type="button"
            >
              <PlayIcon />
              {tinker.running ? 'Running' : 'Run'}
              <span className="tinker-editor__shortcut" title="⌘ Enter or ⌘ R">
                ⌘↵
              </span>
            </button>
          </div>
        </div>

        <CodeEditor
          classes={classes}
          code={snippets.code}
          key={snippets.activeId}
          onChange={snippets.setCode}
          onRun={() => void tinker.run(snippets.code)}
        />

        <div className="tinker-editor__foot">
          {tinker.problem === null ? (
            <>
              <span>{tinker.container?.workingDir ?? 'no container'}</span>
              <span>{tinker.tenant === CENTRAL ? 'central' : tinker.tenant}</span>
            </>
          ) : (
            <span className="tinker-editor__problem">{tinker.problem}</span>
          )}
          <span className="tinker-editor__lines">{snippets.code.split('\n').length} lines</span>
        </div>
      </section>

      <Splitter
        onDrag={(clientX) => {
          const rect = body.current?.getBoundingClientRect()

          if (rect !== undefined) {
            resize((clientX - rect.left - side.width) / (rect.width - side.width))
          }
        }}
        onReset={reset}
      />

      <OutputPane
        collapsed={tinker.collapsed}
        containerName={tinker.container?.name ?? 'the container'}
        flex={1 - split}
        onClear={tinker.clear}
        onCollapseAll={tinker.collapseAll}
        onExpandAll={tinker.expandAll}
        onToggle={tinker.toggle}
        outcome={tinker.outcome}
        running={tinker.running}
      />
    </div>
  )
}

function PlayIcon() {
  return (
    <svg fill="currentColor" height="14" viewBox="0 0 24 24" width="14">
      <path d="M7 5.2v13.6a1 1 0 0 0 1.5.86l11.2-6.8a1 1 0 0 0 0-1.72L8.5 4.34A1 1 0 0 0 7 5.2Z" />
    </svg>
  )
}
