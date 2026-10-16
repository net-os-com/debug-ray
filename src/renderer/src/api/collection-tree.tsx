import { useState } from 'react'
import type { SavedRequest } from '../../../shared/api'
import { folderTree, type FolderNode } from './folders'
import { SavedEditor } from './saved-editor'
import { methodColor } from './method-color'
import { Caret } from './caret'
import { operationIdOf, type ApiState } from './use-api'

/**
 * The indent per level, and where each kind of row starts.
 *
 * A folder sits a step inside its collection and a request a step inside its
 * folder, which is the only thing telling you where you are once a tree is three
 * levels deep and the names are all short.
 */
const INDENT_PX = 12
const FOLDER_PX = 20
const REQUEST_PX = 29

type CollectionTreeProps = {
  api: ApiState
  collection: string
  requests: SavedRequest[]
  /** Which folders are shut, by `collection/path`. Folders open by default. */
  shut: Set<string>
  onToggle: (key: string) => void
}

/**
 * A collection, drawn as the tree its folders make.
 *
 * Folders come from what the requests say they are, so this is a view of the
 * file rather than a second place where the structure is kept.
 */
export function CollectionTree({
  api,
  collection,
  requests,
  shut,
  onToggle,
}: CollectionTreeProps) {
  return (
    <Level
      api={api}
      collection={collection}
      depth={0}
      node={folderTree(requests)}
      onToggle={onToggle}
      shut={shut}
    />
  )
}

type LevelProps = {
  api: ApiState
  collection: string
  node: FolderNode
  depth: number
  shut: Set<string>
  onToggle: (key: string) => void
}

function Level({ api, collection, node, depth, shut, onToggle }: LevelProps) {
  return (
    <>
      {node.folders.map((folder) => {
        const key = `${collection}/${folder.path}`
        const open = !shut.has(key)

        return (
          <div key={key}>
            <button
              className="api-side__folder"
              onClick={() => onToggle(key)}
              style={{ paddingLeft: FOLDER_PX + depth * INDENT_PX }}
              title={folder.path}
              type="button"
            >
              <Caret open={open} />
              <span className="api-side__prefix">{folder.name}</span>
              <span className="api-side__count">{count(folder)}</span>
            </button>

            {open ? (
              <Level
                api={api}
                collection={collection}
                depth={depth + 1}
                node={folder}
                onToggle={onToggle}
                shut={shut}
              />
            ) : null}
          </div>
        )
      })}

      {node.requests.map((one) => (
        <SavedRow
          api={api}
          collection={collection}
          depth={depth}
          key={one.operationId ?? `${one.method} ${one.path}`}
          request={one}
        />
      ))}
    </>
  )
}

type SavedRowProps = {
  api: ApiState
  collection: string
  request: SavedRequest
  depth: number
}

function SavedRow({ api, collection, request, depth }: SavedRowProps) {
  const [mode, setMode] = useState<'idle' | 'confirm' | 'edit'>('idle')
  const operationId = request.operationId ?? operationIdOf(request.method, request.path)
  // The one that is open, and changed since it was read: the file in the
  // repository no longer says what the boxes on the right do.
  const unsaved =
    api.dirty && api.origin?.collection === collection && api.origin.operationId === operationId
  const busy = api.writing.includes(`${collection}/${operationId}`)

  if (mode === 'confirm') {
    return (
      <div
        className="api-side__confirm"
        style={{ paddingLeft: REQUEST_PX + depth * INDENT_PX }}
      >
        {busy ? (
          <>
            <span className="api-side__spinner" />
            <span className="api-side__confirm-text">Removing…</span>
          </>
        ) : (
          <>
            <span className="api-side__confirm-text">Remove “{request.name}”?</span>
            <button className="api-side__confirm-no" onClick={() => setMode('idle')} type="button">
              Cancel
            </button>
            <button
              className="api-side__confirm-yes"
              onClick={() => void api.forgetSaved(collection, operationId)}
              type="button"
            >
              Remove
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <div className={busy ? 'api-side__saved api-side__saved--busy' : 'api-side__saved'}>
        <button
          className="api-side__route"
          onClick={() => api.openSaved(request, collection)}
          style={{ paddingLeft: REQUEST_PX + depth * INDENT_PX }}
          title={`${request.method} ${request.path}`}
          type="button"
        >
          <span className="api-side__method" style={{ color: methodColor(request.method) }}>
            {request.method}
          </span>
          <span className="api-side__uri">{request.name}</span>
          {unsaved ? (
            <span className="api-side__unsaved" title="Changed since it was saved" />
          ) : null}
        </button>

        {busy ? (
          <span className="api-side__spinner api-side__busy" title="Writing to the collection file" />
        ) : (
          <>
            <button
              className="api-side__forget api-side__edit"
              onClick={() => setMode(mode === 'edit' ? 'idle' : 'edit')}
              title="Move or rename"
              type="button"
            >
              ⋯
            </button>

            <button
              className="api-side__forget"
              onClick={() => setMode('confirm')}
              title="Remove from this collection"
              type="button"
            >
              ×
            </button>
          </>
        )}
      </div>

      {mode === 'edit' ? (
        <SavedEditor
          api={api}
          collection={collection}
          onDone={() => setMode('idle')}
          request={request}
        />
      ) : null}
    </>
  )
}

/** What a folder holds, counting everything under it rather than one level. */
function count(node: FolderNode): number {
  return node.requests.length + node.folders.reduce((total, one) => total + count(one), 0)
}
