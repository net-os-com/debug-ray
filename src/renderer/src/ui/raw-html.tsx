/**
 * Payloads such as table, custom and mailable carry HTML that Ray renders
 * as-is. Trusted the same way Ray trusts it: it comes from your own app.
 */
export function RawHtml({ html }: { html: string }) {
  return <div className="raw-html" dangerouslySetInnerHTML={{ __html: html }} />
}
