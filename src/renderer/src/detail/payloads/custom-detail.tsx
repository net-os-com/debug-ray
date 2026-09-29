import { ValueDetail } from '../value-detail'
import { CodeBlock, type Language } from './code-block'
import { customKind, imageSource } from './custom-kind'
import { decodeSent, looksLikeHtml } from './decode-html'
import { HtmlDetail } from './html-detail'
import { ImageDetail } from './image-detail'
import { JsonTree } from './json-tree'

/**
 * Nine of Ray's helpers share one payload type.
 *
 * image(), html(), markdown(), xml(), file(), text(), json(), bool() and null()
 * all arrive as `custom`, each with its content already flattened into a string
 * of HTML and a label saying which one it was. Reading that label is the whole
 * difference between showing a picture and showing the tag that would have
 * drawn it.
 */
export function CustomDetail({ content }: { content: Record<string, unknown> }) {
  const value = content.content
  const label = typeof content.label === 'string' ? content.label : ''

  switch (customKind(label, value)) {
    case 'image': {
      const src = imageSource(value)

      return src === null ? <ValueDetail allowHtml value={value} /> : <ImageDetail src={src} />
    }

    case 'html':
      return <HtmlDetail caption="HTML" html={String(value)} />

    case 'markdown':
      return <HtmlDetail caption="Markdown" html={String(value)} />

    case 'xml':
      return <CodeBlock caption="XML" code={decodeSent(String(value))} language="markup" />

    case 'file':
      return <CodeBlock caption={label} code={decodeSent(String(value))} language={languageOf(label)} />

    case 'text':
      return <CodeBlock code={decodeSent(String(value))} />

    case 'json':
      return <JsonTree value={value} />

    case 'bool':
      return <Constant value={value === true ? 'true' : 'false'} />

    case 'null':
      return <Constant value="null" />

    default:
      // A label nobody here knows: it still came from an app that meant
      // something by it, so show it rather than swallowing it.
      return (
        <div className="detail-stack">
          {label === '' ? null : <div className="detail-heading">{label}</div>}
          {typeof value === 'string' && !looksLikeHtml(value) ? (
            <CodeBlock code={value} />
          ) : (
            <ValueDetail allowHtml value={value} />
          )}
        </div>
      )
  }
}

/** A payload whose entire content is one word deserves to be legible as one. */
function Constant({ value }: { value: string }) {
  return <div className="constant-detail">{value}</div>
}

const MARKUP_FILE = /\.(x?html?|xml|svg|vue)$|\.blade\.php$/i
const PHP_FILE = /\.(php|stub)$/i

/** A Blade file is markup with PHP in it; markup is the half worth colouring. */
function languageOf(name: string): Language {
  if (MARKUP_FILE.test(name)) {
    return 'markup'
  }

  return PHP_FILE.test(name) ? 'php' : null
}
